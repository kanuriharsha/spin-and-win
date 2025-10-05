const router = require('express').Router();
const Spin = require('../models/spin.model');

// List recent spins
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const items = await Spin.find().sort({ createdAt: -1 }).limit(limit);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// Create a spin
router.post('/', async (req, res, next) => {
  try {
    const { userId, prize } = req.body || {};
    const created = await Spin.create({ userId, prize });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// Central error handler for this router
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = router;
