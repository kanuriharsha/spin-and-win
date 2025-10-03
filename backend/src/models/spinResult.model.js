const mongoose = require('mongoose');

const SpinResultSchema = new mongoose.Schema(
  {
    wheelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wheel', required: true },
    routeName: { type: String, required: true },
    // User form data
    surname: { type: String, required: true },
    name: { type: String, required: true },
    amountSpent: { type: String, required: true },
    // Timing data
    inTime: { type: Date, required: true }, // When form was submitted
    outTime: { type: Date }, // When prize was won
    // Spin result
    winner: { type: String }, // The winning segment text
    approved: { type: Boolean, default: false },
    // Additional data
    userAgent: { type: String },
    ipAddress: { type: String },
    sessionId: { type: String }
  },
  {
    collection: 'spinResults',
    timestamps: true
  }
);

module.exports = mongoose.model('SpinResult', SpinResultSchema);
