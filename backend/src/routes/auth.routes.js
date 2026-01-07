const router = require('express').Router();
const Login = require('../models/login.model');
const Wheel = require('../models/wheel.model');

// POST /api/auth/login - Admin login
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
    return res.json({ ok: true, role: 'admin' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/client-login - Client login
router.post('/client-login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'Missing credentials' });
    }

    const doc = await Login.findOne({ username, password }).lean();
    if (!doc) return res.status(401).json({ ok: false, message: 'Invalid username or password' });

    // Check if access is enabled
    if (doc.access === 'disable') {
      return res.status(403).json({ ok: false, message: 'Your account has been disabled. Please contact administrator.' });
    }

    // Client must NOT have routeName === 'all' (that's admin only)
    const routeName = String(doc.routeName || '').trim();
    const routeNameLower = routeName.toLowerCase();
    if (routeNameLower === 'all' || !routeName) {
      return res.status(403).json({ ok: false, message: 'Access denied' });
    }

    // Find the wheel associated with this routeName (case-insensitive search)
    const wheel = await Wheel.findOne({ 
      routeName: { $regex: new RegExp(`^${routeName}$`, 'i') }
    }).lean();
    if (!wheel) {
      return res.status(404).json({ ok: false, message: `No wheel found for route: ${routeName}. Please contact administrator.` });
    }

    // Return client session data
    return res.json({ 
      ok: true, 
      role: 'client',
      clientId: doc._id.toString(),
      username: doc.username,
      routeName: doc.routeName,
      wheelId: wheel._id.toString()
    });
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
