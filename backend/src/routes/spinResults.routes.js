const router = require('express').Router();
const SpinResult = require('../models/spinResult.model');

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

// Start a session after form submit
router.post('/session', async (req, res, next) => {
  try {
    const doc = await SpinResult.create({
      ...req.body,
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
    const updated = await SpinResult.findByIdAndUpdate(
      req.params.sessionId,
      { winner: req.body.winner, outTime: new Date() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Session not found' });
    res.json(updated);
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
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = router;
    
//     if (!updated) {
//       return res.status(404).json({ message: 'Result not found' });
//     }
    
//     res.json(updated);
//   } catch (err) {
//     next(err);
//   }
// });

// // Error handler
// router.use((err, req, res, next) => {
//   console.error(err);
//   res.status(500).json({ error: err.message || 'Internal Server Error' });
// });

// module.exports = router;
