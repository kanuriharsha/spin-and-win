const router = require('express').Router();
const Analytics = require('../models/analytics.model');

// Get all analytics records
router.get('/', async (req, res, next) => {
  try {
    const { wheelId, routeName, rewardType, rewardGranted } = req.query;
    const filter = {};

    if (wheelId) filter.wheelId = wheelId;
    if (routeName) filter.routeName = routeName;
    if (rewardType) filter.rewardType = rewardType;
    if (rewardGranted !== undefined) filter.rewardGranted = rewardGranted === 'true';

    const analytics = await Analytics.find(filter)
      .populate('wheelId', 'wheelName')
      .populate('userId', 'name surname')
      .sort({ createdAt: -1 });

    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

// Get analytics by wheel ID
router.get('/wheel/:wheelId', async (req, res, next) => {
  try {
    const analytics = await Analytics.find({ wheelId: req.params.wheelId })
      .populate('userId', 'name surname')
      .sort({ createdAt: -1 });

    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

// Get analytics by route name
router.get('/route/:routeName', async (req, res, next) => {
  try {
    const analytics = await Analytics.find({ routeName: req.params.routeName })
      .populate('wheelId', 'wheelName')
      .populate('userId', 'name surname')
      .sort({ createdAt: -1 });

    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

// Get reward summary statistics
router.get('/summary/stats', async (req, res, next) => {
  try {
    const { wheelId, routeName, startDate, endDate } = req.query;
    const filter = { rewardGranted: true };

    if (wheelId) filter.wheelId = wheelId;
    if (routeName) filter.routeName = routeName;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const total = await Analytics.countDocuments(filter);
    const approved = await Analytics.countDocuments({ ...filter, approved: true });

    const byType = await Analytics.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$rewardType',
          count: { $sum: 1 },
          details: {
            $push: {
              rewardText: '$rewardText',
              amount: {
                $cond: [
                  { $eq: ['$rewardType', 'cash'] },
                  '$cashAmount',
                  {
                    $cond: [
                      { $eq: ['$rewardType', 'loyalty'] },
                      { $literal: '$loyaltyPoints' },
                      {
                        $cond: [
                          { $eq: ['$rewardType', 'percentage'] },
                          { $concat: [{ $toString: '$percentageOff' }, '%'] },
                          ''
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    const totalCashValue = await Analytics.aggregate([
      { $match: { ...filter, rewardType: 'cash' } },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: '$cashAmount' } }
        }
      }
    ]);

    const totalLoyaltyPoints = await Analytics.aggregate([
      { $match: { ...filter, rewardType: 'loyalty' } },
      {
        $group: {
          _id: null,
          total: { $sum: '$loyaltyPoints' }
        }
      }
    ]);

    const totalDiscountValue = await Analytics.aggregate([
      { $match: { ...filter, rewardType: 'percentage' } },
      {
        $group: {
          _id: null,
          total: { $sum: '$discountAmount' }
        }
      }
    ]);

    res.json({
      totalRewards: total,
      approvedRewards: approved,
      pendingRewards: total - approved,
      byType,
      totalCashValue: totalCashValue[0]?.total || 0,
      totalLoyaltyPoints: totalLoyaltyPoints[0]?.total || 0,
      totalDiscountValue: totalDiscountValue[0]?.total || 0
    });
  } catch (err) {
    next(err);
  }
});

// Get analytics by reward type
router.get('/type/:rewardType', async (req, res, next) => {
  try {
    const analytics = await Analytics.find({ 
      rewardType: req.params.rewardType,
      rewardGranted: true 
    })
      .populate('wheelId', 'wheelName')
      .populate('userId', 'name surname')
      .sort({ createdAt: -1 });

    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

// Approve/Reject a reward
router.patch('/:id/approve', async (req, res, next) => {
  try {
    const { approved, approvedBy } = req.body;

    const analytics = await Analytics.findByIdAndUpdate(
      req.params.id,
      {
        approved,
        approvedBy,
        approvedAt: approved ? new Date() : null
      },
      { new: true }
    );

    if (!analytics) {
      return res.status(404).json({ message: 'Analytics record not found' });
    }

    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

// Delete an analytics record
router.delete('/:id', async (req, res, next) => {
  try {
    const analytics = await Analytics.findByIdAndDelete(req.params.id);

    if (!analytics) {
      return res.status(404).json({ message: 'Analytics record not found' });
    }

    res.json({ message: 'Analytics record deleted successfully', analytics });
  } catch (err) {
    next(err);
  }
});

// Error handler
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = router;
