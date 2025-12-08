const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema(
  {
    wheelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wheel', required: true },
    spinResultId: { type: mongoose.Schema.Types.ObjectId, ref: 'SpinResult', required: true },
    routeName: { type: String, required: true },
    
    // User info
    surname: { type: String, default: '' },
    name: { type: String, default: '' },
    amountSpent: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Reward details
    rewardGranted: { type: Boolean, default: false },
    rewardType: { type: String, enum: ['cash', 'loyalty', 'percentage', 'other'], default: 'other' },
    rewardText: { type: String, default: '' }, // The winning segment text
    
    // Prize amounts by type
    cashAmount: { type: String, default: '' }, // e.g., "₹500"
    loyaltyPoints: { type: Number, default: 0 },
    percentageOff: { type: Number, default: null }, // e.g., 3 (for 3%)
    discountAmount: { type: Number, default: null }, // calculated discount amount
    originalPrice: { type: Number, default: null },
    finalPrice: { type: Number, default: null },
    
    // Status
    approved: { type: Boolean, default: false },
    approvedBy: { type: String, default: '' },
    approvedAt: { type: Date },
    
    // Metadata
    sessionCreatedAt: { type: Date },
    rewardClaimedAt: { type: Date },
    userAgent: { type: String },
    ipAddress: { type: String },
    sessionId: { type: String }
  },
  {
    collection: 'analytics',
    timestamps: true
  }
);

// Index for fast lookups
AnalyticsSchema.index({ wheelId: 1, createdAt: -1 });
AnalyticsSchema.index({ routeName: 1, createdAt: -1 });
AnalyticsSchema.index({ rewardGranted: 1 });
AnalyticsSchema.index({ rewardType: 1 });
AnalyticsSchema.index({ approved: 1 });

module.exports = mongoose.model('Analytics', AnalyticsSchema);
