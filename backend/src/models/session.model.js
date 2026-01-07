const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    deviceFingerprint: {
      type: String,
      required: true,
      index: true
    },
    routeName: {
      type: String,
      required: true,
      index: true
    },
    wheelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wheel',
      required: true
    },
    lastSpinAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    winner: { type: String },
    prizeType: { type: String },
    prizeAmount: { type: String },
    percentageValue: { type: Number },
    computedReward: { type: Number }
  },
  {
    collection: 'sessions',
    timestamps: true
  }
);

// Compound index for efficient lookups
SessionSchema.index({ deviceFingerprint: 1, routeName: 1, wheelId: 1 });

// TTL index to auto-delete expired sessions
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', SessionSchema);
