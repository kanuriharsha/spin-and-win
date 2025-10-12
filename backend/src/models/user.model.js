const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  surname: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  loyaltyPoints: { type: Number, default: 0, min: 0 },
  // History of loyalty point transactions
  pointsHistory: [{
    wheelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wheel' },
    spinResultId: { type: mongoose.Schema.Types.ObjectId, ref: 'SpinResult' },
    points: { type: Number, required: true },
    prize: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, { 
  collection: 'users',
  timestamps: true 
});

// Index for fast lookup by surname + name
UserSchema.index({ surname: 1, name: 1 });

module.exports = mongoose.model('User', UserSchema);
