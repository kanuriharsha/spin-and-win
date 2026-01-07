const router = require('express').Router();
console.log('Loaded client.routes');
const PendingUpdate = require('../models/pendingUpdate.model');
const Wheel = require('../models/wheel.model');
const Login = require('../models/login.model');

// Middleware to verify client token (simplified - in production use JWT)
const verifyClient = async (req, res, next) => {
  // HTTP headers are lower-cased by Node/Express. Accept common variants.
  const clientId = req.headers['clientid'] || req.headers['client-id'] || req.headers['clientId'] || req.get('clientId');
  const wheelId = req.headers['wheelid'] || req.headers['wheel-id'] || req.headers['wheelId'] || req.get('wheelId');
  const routeNameHeader = req.headers['routename'] || req.headers['route-name'] || req.headers['routeName'] || req.get('routeName');

  if (!clientId || !wheelId || !routeNameHeader) {
    return res.status(401).json({ ok: false, message: 'Unauthorized - Missing client credentials' });
  }

  try {
    // Debug: log incoming header-derived values
    console.log('[verifyClient] headers clientId, wheelId, routeNameHeader ->', { clientId, wheelId, routeNameHeader });

    // Verify the client exists and has access
    const login = await Login.findById(clientId).lean();
    if (!login || login.access === 'disable') {
      return res.status(403).json({ ok: false, message: 'Access denied - Account disabled or not found' });
    }

    // Normalize route names (trim + case-insensitive) and verify match
    const loginRoute = (login.routeName || '').toString().trim().toLowerCase();
    const requestedRoute = (routeNameHeader || '').toString().trim().toLowerCase();
    if (loginRoute !== requestedRoute) {
      return res.status(403).json({ ok: false, message: 'Access denied - Route mismatch' });
    }

    // Verify the wheel belongs to this client's routeName (case-insensitive)
    const wheel = await Wheel.findById(wheelId).lean();
    if (!wheel) {
      return res.status(404).json({ ok: false, message: 'Wheel not found' });
    }
    
    const wheelRoute = (wheel.routeName || '').toString().trim().toLowerCase();
    if (wheelRoute !== requestedRoute) {
      return res.status(403).json({ ok: false, message: 'Access denied to this wheel - Route mismatch' });
    }

    req.client = { clientId, wheelId, routeName: wheel.routeName, username: login.username };
    next();
  } catch (err) {
    next(err);
  }
};

// GET /api/client/wheel - Get client's assigned wheel (read-only)
router.get('/wheel', verifyClient, async (req, res, next) => {
  try {
    const wheel = await Wheel.findById(req.client.wheelId).lean();
    if (!wheel) {
      return res.status(404).json({ ok: false, message: 'Wheel not found' });
    }
    
    // Return only necessary data for viewing
    return res.json({ 
      ok: true,
      wheel: {
        _id: wheel._id,
        name: wheel.name,
        routeName: wheel.routeName,
        description: wheel.description,
        segments: wheel.segments,
        centerImage: wheel.centerImage,
        wheelBackgroundColor: wheel.wheelBackgroundColor,
        centerImageRadius: wheel.centerImageRadius
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/client/submit-update - Submit segment updates for admin review
router.post('/submit-update', verifyClient, async (req, res, next) => {
  try {
    const { segmentUpdates, meta = {} } = req.body;
    
    if (!segmentUpdates || !Array.isArray(segmentUpdates) || segmentUpdates.length === 0) {
      return res.status(400).json({ ok: false, message: 'No updates provided' });
    }

    // Get current wheel state
    const wheel = await Wheel.findById(req.client.wheelId);
    if (!wheel) {
      return res.status(404).json({ ok: false, message: 'Wheel not found' });
    }

    // Validate and prepare updates
    const validatedUpdates = [];
    for (const update of segmentUpdates) {
      const { segmentIndex, updatedData } = update;

      if (segmentIndex < 0) {
        return res.status(400).json({ ok: false, message: `Invalid segment index: ${segmentIndex}` });
      }

      // If the client added a new segment, allow append beyond current length
      if (segmentIndex >= wheel.segments.length) {
        validatedUpdates.push({
          segmentIndex,
          previousData: null,
          updatedData: {
            text: updatedData.text,
            color: updatedData.color,
            image: updatedData.image,
            prizeType: updatedData.prizeType,
            amount: updatedData.amount,
            dailyLimit: updatedData.dailyLimit,
            rules: updatedData.rules || []
          }
        });
        continue;
      }

      const previousSegment = wheel.segments[segmentIndex];
      validatedUpdates.push({
        segmentIndex,
        previousData: {
          text: previousSegment.text,
          color: previousSegment.color,
          image: previousSegment.image,
          prizeType: previousSegment.prizeType,
          amount: previousSegment.amount,
          dailyLimit: previousSegment.dailyLimit,
          rules: previousSegment.rules || []
        },
        updatedData: {
          text: updatedData.text || previousSegment.text,
          color: updatedData.color || previousSegment.color,
          image: updatedData.image !== undefined ? updatedData.image : previousSegment.image,
          prizeType: updatedData.prizeType || previousSegment.prizeType,
          amount: updatedData.amount !== undefined ? updatedData.amount : previousSegment.amount,
          dailyLimit: updatedData.dailyLimit !== undefined ? updatedData.dailyLimit : previousSegment.dailyLimit,
          rules: updatedData.rules !== undefined ? updatedData.rules : previousSegment.rules || []
        }
      });
    }

    // Create pending update record (carry meta so admin can keep hidden fields intact)
    const pendingUpdate = new PendingUpdate({
      clientId: req.client.clientId,
      clientUsername: req.client.username,
      wheelId: req.client.wheelId,
      routeName: req.client.routeName,
      segmentUpdates: validatedUpdates,
      meta: {
        name: meta.name || wheel.name,
        routeName: meta.routeName || wheel.routeName,
        spinDurationSec: meta.spinDurationSec || wheel.spinDurationSec,
        spinBaseTurns: meta.spinBaseTurns || wheel.spinBaseTurns,
        sessionExpiryMinutes: meta.sessionExpiryMinutes || wheel.sessionExpiryMinutes
      },
      status: 'pending'
    });

    await pendingUpdate.save();

    return res.json({ 
      ok: true, 
      message: 'Your changes have been submitted for admin review',
      updateId: pendingUpdate._id
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/client/pending-updates - Get client's pending updates
router.get('/pending-updates', verifyClient, async (req, res, next) => {
  try {
    const updates = await PendingUpdate.find({ 
      clientId: req.client.clientId,
      status: { $in: ['pending', 'approved', 'rejected'] }
    }).sort({ submittedAt: -1 }).limit(10).lean();
    
    return res.json({ ok: true, updates });
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
