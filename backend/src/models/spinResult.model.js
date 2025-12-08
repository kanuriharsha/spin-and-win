const mongoose = require('mongoose');

const SpinResultSchema = new mongoose.Schema(
  {
    wheelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wheel', required: true },
    routeName: { type: String, required: true },
    surname: { type: String, default: '' },      // was required: true
    name: { type: String, default: '' },         // was required: true
    amountSpent: { type: String, default: '' },  // was required: true
    // New: store custom field data as key-value pairs
    customFieldData: { type: Map, of: String, default: {} },
    inTime: { type: Date, required: true }, // When form was submitted or session created
    outTime: { type: Date }, // When prize was won
    winner: { type: String }, // The winning segment text
    prizeType: { type: String, enum: ['cash', 'loyalty', 'other', 'percentage'], default: 'other' },
    prizeAmount: { type: String, default: '' }, // e.g., "₹500", "30 Loyalty Points"
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Link to user if loyalty points awarded
    approved: { type: Boolean, default: false },
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
