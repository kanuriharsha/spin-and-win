const mongoose = require('mongoose');

const SpinSchema = new mongoose.Schema(
  {
    userId: { type: String },
    prize: { type: String },
    createdAt: { type: Date, default: Date.now }
  },
  {
    collection: 'spin-and-win' // use the exact collection name
  }
);

module.exports = mongoose.model('Spin', SpinSchema);
