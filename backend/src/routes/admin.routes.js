const router = require('express').Router();
const PendingUpdate = require('../models/pendingUpdate.model');
const Wheel = require('../models/wheel.model');

// helper to build sort from query
function buildSort(sortBy, sortDir) {
  const dir = sortDir === 'asc' ? 1 : -1;
  switch (sortBy) {
    case 'routeName': return { routeName: dir, submittedAt: -1 };
    case 'client': return { clientUsername: dir, submittedAt: -1 };
    case 'status': return { status: dir, submittedAt: -1 };
    default: return { submittedAt: dir };
  }
}

// GET /api/admin/pending-updates - Get pending updates for admin review (with filters)
router.get('/pending-updates', async (req, res, next) => {
  try {
    const { routeName, sortBy = 'submittedAt', sortDir = 'desc', limit = 100 } = req.query;
    const query = { status: 'pending' };
    if (routeName) query.routeName = routeName;

    const updates = await PendingUpdate.find(query)
      .populate('wheelId', 'name routeName')
      .sort(buildSort(sortBy, sortDir))
      .limit(parseInt(limit))
      .lean();
    
    return res.json({ ok: true, updates });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/all-updates - Get all updates (pending, approved, rejected)
router.get('/all-updates', async (req, res, next) => {
  try {
    const { status, routeName, sortBy = 'submittedAt', sortDir = 'desc', limit = 100 } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (routeName) query.routeName = routeName;
    
    const updates = await PendingUpdate.find(query)
      .populate('wheelId', 'name routeName')
      .sort(buildSort(sortBy, sortDir))
      .limit(parseInt(limit))
      .lean();
    
    return res.json({ ok: true, updates });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/update/:id - Get a single update with wheel populated
router.get('/update/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const update = await PendingUpdate.findById(id)
      .populate('wheelId', 'name routeName segments centerImage wheelBackgroundColor centerImageRadius spinDurationSec spinBaseTurns sessionExpiryMinutes wrapperBackgroundColor')
      .lean();
    if (!update) {
      return res.status(404).json({ ok: false, message: 'Update not found' });
    }
    return res.json({ ok: true, update });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/update/:id - Remove an update (e.g., mistaken submission)
router.delete('/update/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await PendingUpdate.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, message: 'Update not found' });
    }
    return res.json({ ok: true, message: 'Update deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/approve-update/:id - Approve and apply a pending update
router.post('/approve-update/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewedBy, reviewNotes } = req.body;

    const pendingUpdate = await PendingUpdate.findById(id);
    if (!pendingUpdate) {
      return res.status(404).json({ ok: false, message: 'Update not found' });
    }

    if (pendingUpdate.status !== 'pending') {
      return res.status(400).json({ ok: false, message: 'Update has already been reviewed' });
    }

    // Get the wheel
    const wheel = await Wheel.findById(pendingUpdate.wheelId);
    if (!wheel) {
      return res.status(404).json({ ok: false, message: 'Wheel not found' });
    }

    // Apply the updates (support updates and appends)
    for (const update of pendingUpdate.segmentUpdates) {
      const { segmentIndex, updatedData } = update;
      
      if (segmentIndex < 0) continue;

      if (segmentIndex >= 0 && segmentIndex < wheel.segments.length) {
        const segment = wheel.segments[segmentIndex];
        segment.text = updatedData.text;
        segment.color = updatedData.color;
        segment.image = updatedData.image;
        segment.prizeType = updatedData.prizeType;
        segment.amount = updatedData.amount;
        segment.dailyLimit = updatedData.dailyLimit;
        segment.rules = updatedData.rules || [];
        continue;
      }

      // Append new segment when client added beyond current length
      if (segmentIndex === wheel.segments.length) {
        wheel.segments.push({
          text: updatedData.text,
          color: updatedData.color,
          image: updatedData.image,
          prizeType: updatedData.prizeType,
          amount: updatedData.amount,
          dailyLimit: updatedData.dailyLimit,
          rules: updatedData.rules || []
        });
      }
    }

    // Preserve admin-only meta fields even for client-submitted updates
    if (pendingUpdate.meta) {
      wheel.name = pendingUpdate.meta.name || wheel.name;
      wheel.routeName = pendingUpdate.meta.routeName || wheel.routeName;
      wheel.spinDurationSec = pendingUpdate.meta.spinDurationSec || wheel.spinDurationSec;
      wheel.spinBaseTurns = pendingUpdate.meta.spinBaseTurns || wheel.spinBaseTurns;
      wheel.sessionExpiryMinutes = pendingUpdate.meta.sessionExpiryMinutes || wheel.sessionExpiryMinutes;
    }

    await wheel.save();

    // Update the pending record
    pendingUpdate.status = 'approved';
    pendingUpdate.reviewedAt = new Date();
    pendingUpdate.reviewedBy = reviewedBy || 'Admin';
    pendingUpdate.reviewNotes = reviewNotes || '';
    await pendingUpdate.save();

    return res.json({ 
      ok: true, 
      message: 'Update approved and applied successfully',
      wheelId: wheel._id,
      routeName: wheel.routeName
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/reject-update/:id - Reject a pending update
router.post('/reject-update/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewedBy, reviewNotes } = req.body;

    const pendingUpdate = await PendingUpdate.findById(id);
    if (!pendingUpdate) {
      return res.status(404).json({ ok: false, message: 'Update not found' });
    }

    if (pendingUpdate.status !== 'pending') {
      return res.status(400).json({ ok: false, message: 'Update has already been reviewed' });
    }

    // Update the pending record
    pendingUpdate.status = 'rejected';
    pendingUpdate.reviewedAt = new Date();
    pendingUpdate.reviewedBy = reviewedBy || 'Admin';
    pendingUpdate.reviewNotes = reviewNotes || '';
    await pendingUpdate.save();

    return res.json({ 
      ok: true, 
      message: 'Update rejected successfully'
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/delete-update/:id - Delete an update record
router.delete('/delete-update/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await PendingUpdate.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ ok: false, message: 'Update not found' });
    }

    return res.json({ ok: true, message: 'Update deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Error handler
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
});

module.exports = router;
