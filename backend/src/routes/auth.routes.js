const router = require('express').Router();
const Login = require('../models/login.model');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'Missing credentials' });
    }

    const doc = await Login.findOne({ username, password }).lean();
    if (!doc) return res.status(401).json({ ok: false, message: 'Invalid username or password' });

    const allowed = String(doc.routeName || '').trim().toLowerCase() === 'all';
    if (!allowed) return res.status(403).json({ ok: false, message: 'Access denied' });

    // Minimal session-less auth: frontend will keep in-memory flag only
    return res.json({ ok: true });
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
