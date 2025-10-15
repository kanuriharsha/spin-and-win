const mongoose = require('mongoose');

const LoginSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  password: { type: String, required: true },
<<<<<<< HEAD
  routeName: { type: String, required: true, trim: true },
  onboard: { type: Date, default: Date.now },
  access: { type: String, enum: ['enable', 'disable'], default: 'enable' }
=======
  routeName: { type: String, required: true, trim: true }
>>>>>>> d79af09766903dbd7cb087598c8d3aafd690b1c1
}, { collection: 'login' });

module.exports = mongoose.model('Login', LoginSchema);
