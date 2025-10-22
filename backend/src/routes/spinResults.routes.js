const router = require('express').Router();
const SpinResult = require('../models/spinResult.model');
const Wheel = require('../models/wheel.model'); // new import

// List latest by wheel id
router.get('/wheel/:wheelId', async (req, res, next) => {
  try {
    const results = await SpinResult.find({ wheelId: req.params.wheelId }).sort({ createdAt: -1 });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// List latest by route name
router.get('/route/:routeName', async (req, res, next) => {
  try {
    const results = await SpinResult.find({ routeName: req.params.routeName }).sort({ createdAt: -1 });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// Start a session after form submit OR when form is disabled (anonymous session)
router.post('/session', async (req, res, next) => {
  try {
    const { wheelId, routeName } = req.body || {};

    if (!wheelId || !routeName) {
      return res.status(400).json({ message: 'wheelId and routeName are required' });
    }

    const wheel = await Wheel.findById(wheelId).lean();
    if (!wheel || (wheel.routeName || '').toLowerCase() !== String(routeName || '').toLowerCase()) {
      return res.status(400).json({ message: 'Invalid wheelId or routeName' });
    }

    const formEnabled = !!(wheel.formConfig?.enabled);
    const surname = (req.body.surname || '').trim();
    const name = (req.body.name || '').trim();
    const amountSpent = (req.body.amountSpent || '').trim();

    if (formEnabled) {
      if (!surname || !name || amountSpent === '') {
        return res.status(400).json({ message: 'Missing required fields' });
      }
    }

    // New: collect custom field data
    const customFieldData = {};
    if (Array.isArray(wheel.formConfig?.customFields)) {
      wheel.formConfig.customFields.forEach(field => {
        customFieldData[field.id] = req.body[field.id] || '';
      });
    }

    const doc = await SpinResult.create({
      wheelId,
      routeName,
      surname: surname || '',        // optional when form disabled
      name: name || '',              // optional when form disabled
      amountSpent: amountSpent || '',// optional when form disabled
      customFieldData, // New: store custom field values
      formEnabled,
      inTime: new Date(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      sessionId: req.sessionID || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    });

    res.status(201).json({ sessionId: doc._id });
  } catch (err) {
    next(err);
  }
});

// Save spin result
router.put('/session/:sessionId/result', async (req, res, next) => {
  try {
    const updateData = { 
      winner: req.body.winner, 
      outTime: new Date() 
    };
    
    // Add prize details if provided
    if (req.body.prizeType) {
      updateData.prizeType = req.body.prizeType;
    }
    if (req.body.prizeAmount !== undefined) {
      updateData.prizeAmount = req.body.prizeAmount;
    }
    if (req.body.userId) {
      updateData.userId = req.body.userId;
    }
    
    const updated = await SpinResult.findByIdAndUpdate(
      req.params.sessionId,
      updateData,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Session not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// New: Check if user already spun (by device fingerprint or sessionId)
router.post('/check-session', async (req, res, next) => {
  try {
    const { routeName, deviceFingerprint } = req.body;
    if (!routeName) {
      return res.status(400).json({ message: 'routeName is required' });
    }

    const wheel = await Wheel.findOne({ routeName }).lean();
    if (!wheel) {
      return res.status(404).json({ message: 'Wheel not found' });
    }

    // Treat 0 as "no expiry" → allow unlimited spins
    const expiryMinutes = (typeof wheel.sessionExpiryMinutes === 'number') ? wheel.sessionExpiryMinutes : 60;
    if (expiryMinutes === 0) {
      return res.json({ hasSpun: false });
    }

    const expiryTime = new Date(Date.now() - expiryMinutes * 60 * 1000);

    // Find recent spin by device fingerprint or IP
    const recentSpin = await SpinResult.findOne({
      routeName,
      winner: { $exists: true, $ne: null },
      outTime: { $gte: expiryTime },
      $or: [
        { sessionId: deviceFingerprint },
        { ipAddress: req.ip }
      ]
    }).sort({ outTime: -1 });

    if (recentSpin) {
      return res.json({
        hasSpun: true,
        winner: recentSpin.winner,
        prizeAmount: recentSpin.prizeAmount,
        prizeType: recentSpin.prizeType,
        outTime: recentSpin.outTime,
        expiresAt: new Date(recentSpin.outTime.getTime() + expiryMinutes * 60 * 1000),
        thankYouMessage: wheel.thankYouMessage || 'Thanks for Availing the Offer!' // New
      });
    }

    res.json({ hasSpun: false });
  } catch (err) {
    next(err);
  }
});

// Update approval flag
router.put('/:id/approve', async (req, res, next) => {
  try {
    const updated = await SpinResult.findByIdAndUpdate(
      req.params.id,
      { approved: !!req.body.approved },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Result not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Local error handler
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = router;
