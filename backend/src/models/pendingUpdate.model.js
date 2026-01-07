const mongoose = require('mongoose');

const PendingUpdateSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  clientUsername: { type: String, required: true },
  wheelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wheel', required: true },
  routeName: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  
  // Store the segment updates
  segmentUpdates: [{
    segmentIndex: { type: Number, required: true },
    previousData: {
      text: String,
      color: String,
      image: String,
      prizeType: String,
      amount: String,
      dailyLimit: Number,
      rules: { type: Array, default: [] }
    },
    updatedData: {
      text: String,
      color: String,
      image: String,
      prizeType: String,
      amount: String,
      dailyLimit: Number,
      rules: { type: Array, default: [] }
    }
  }],

  // Admin-only metadata that should be preserved even when clients submit updates
  meta: {
    name: String,
    routeName: String,
    spinDurationSec: Number,
    spinBaseTurns: Number,
    sessionExpiryMinutes: Number
  },
  
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: String },
  reviewNotes: { type: String }
}, { collection: 'pendingUpdates' });

module.exports = mongoose.model('PendingUpdate', PendingUpdateSchema);
