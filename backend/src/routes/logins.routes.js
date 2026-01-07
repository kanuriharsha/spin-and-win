const router = require('express').Router();
const mongoose = require('mongoose');
const SpinResult = require('../models/spinResult.model'); // added

const Login = mongoose.model('Login', new mongoose.Schema({
  username: String,
  password: String,
  routeName: String
}, { collection: 'login' }));

// helper to escape regex
function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// List all logins
router.get('/', async (req, res, next) => {
  try {
    const logins = await Login.find();
    res.json(logins);
  } catch (err) {
    next(err);
  }
});

// Update a login
router.put('/:id', async (req, res, next) => {
  try {
    const updated = await Login.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Delete a login
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const login = await Login.findById(id);
    if (!login) return res.status(404).json({ ok: false, message: 'Login not found' });

    const routeName = String(login.routeName || '').trim();
    // delete spinResults that match routeName (case-insensitive)
    if (routeName) {
      const regex = new RegExp(`^${escapeRegExp(routeName)}$`, 'i');
      const delRes = await SpinResult.deleteMany({ routeName: regex });
      // proceed to delete login
      await Login.findByIdAndDelete(id);
      return res.json({ ok: true, message: 'Login and related spinResults deleted', deletedSpinResults: delRes.deletedCount || 0 });
    }

    // fallback: just delete login if no routeName
    await Login.findByIdAndDelete(id);
    res.json({ ok: true, message: 'Login deleted', deletedSpinResults: 0 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
