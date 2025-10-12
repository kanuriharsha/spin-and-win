const mongoose = require('mongoose');

const LoginSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  routeName: { type: String, required: true, trim: true }
}, { collection: 'login' });

module.exports = mongoose.model('Login', LoginSchema);
