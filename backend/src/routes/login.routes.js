const router = require('express').Router();
const Login = require('../models/login.model');

// GET /api/logins - Get all login records
router.get('/', async (req, res, next) => {
  try {
    const logins = await Login.find({}).lean();
    return res.json(logins);
  } catch (err) {
    next(err);
  }
});

// GET /api/logins/:id - Get a single login record
router.get('/:id', async (req, res, next) => {
  try {
    const login = await Login.findById(req.params.id).lean();
    if (!login) {
      return res.status(404).json({ ok: false, message: 'Login not found' });
    }
    return res.json(login);
  } catch (err) {
    next(err);
  }
});

// PUT /api/logins/:id - Update a login record
router.put('/:id', async (req, res, next) => {
  try {
    const { username, password, routeName, access, onboard } = req.body;
    if (!username || !password || !routeName) {
      return res.status(400).json({ ok: false, message: 'All fields are required' });
    }

    const updateData = { username, password, routeName };
    if (access && ['enable', 'disable'].includes(access)) {
      updateData.access = access;
    }
    if (onboard) {
      // Accept string (YYYY-MM-DD or ISO) and convert to Date
      updateData.onboard = new Date(onboard);
    }

    const updated = await Login.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ ok: false, message: 'Login not found' });
    }

    return res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/logins - Create a new login record
router.post('/', async (req, res, next) => {
  try {
    const { username, password, routeName, onboard, access } = req.body;
    if (!username || !password || !routeName) {
      return res.status(400).json({ ok: false, message: 'All fields are required' });
    }

    const newLogin = new Login({
      username,
      password,
      routeName,
      onboard: onboard ? new Date(onboard) : new Date(),
      access: ['enable', 'disable'].includes(access) ? access : 'enable'
    });
    await newLogin.save();

    return res.status(201).json({ ok: true, data: newLogin });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/logins/:id - Delete a login record
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Login.findByIdAndDelete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ ok: false, message: 'Login not found' });
    }

    return res.json({ ok: true, message: 'Login deleted successfully' });
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
