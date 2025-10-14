const router = require('express').Router();
const mongoose = require('mongoose');

const Login = mongoose.model('Login', new mongoose.Schema({
  username: String,
  password: String,
  routeName: String
}, { collection: 'login' }));

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
    await Login.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
