const mongoose = require('mongoose');

const LoginSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  routeName: { type: String, required: true, trim: true },
  onboard: { type: Date, default: Date.now },
  access: { type: String, enum: ['enable', 'disable'], default: 'enable' }
}, { collection: 'login' });

module.exports = mongoose.model('Login', LoginSchema);
