const mongoose = require('mongoose');

const WheelSchema = new mongoose.Schema(
  {
    name: { 
      type: String,
      required: true,
      trim: true
    },
    routeName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    // New: wheel description (shown as subheading on route page)
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    segments: [{
      text: { type: String, required: true },
      color: { type: String, required: true },
      image: { type: String }, // Base64 encoded image data
      // Prize details
      prizeType: { type: String, enum: ['cash', 'loyalty', 'other'], default: 'other' },
      amount: { type: String, default: '' }, // e.g., "₹500", "30 Loyalty Points", or any custom text
      // New: per-day occurrence limiting
      dailyLimit: { type: Number, default: null }, // null/undefined => unlimited
      dailyRemaining: { type: Number, default: null }, // null when unlimited
      lastResetAt: { type: Date }, // date at start of day when counts were last reset
      // New: amount-based rules that can override the daily limit for eligibility
      rules: [{
        op: { type: String, enum: ['>', '>=', '<', '<=', '==', '!='], required: true },
        amount: { type: Number, required: true, min: 0 },
        dailyLimit: { type: Number, required: true, min: 0, max: 1000 }
      }]
    }],
    centerImage: { type: String }, // Base64 encoded image data
    // New: wheel background color
    wheelBackgroundColor: { type: String, default: '#ffffff' },
    // New: container (wrapper) background color
    wrapperBackgroundColor: { type: String, default: '#ffffff' },
    // New: persisted center image radius (SVG units, default matches current UI)
    centerImageRadius: { type: Number, default: 70, min: 20, max: 160 },
    // New: editor-configurable spin animation config
    spinDurationSec: { type: Number, min: 1, max: 60, default: null },
    spinBaseTurns: { type: Number, default: 6, min: 1, max: 20 },        // rotations before landing
    // Form configuration
    formConfig: {
      enabled: { type: Boolean, default: true },
      title: { type: String, default: 'Enter Your Details' },
      subtitle: { type: String, default: 'Please fill in your information to spin the wheel' },
      // New: intro text shown above form fields
      introText: { type: String, default: '' },
      // New: hero banner configuration
      heroBanner: {
        enabled: { type: Boolean, default: false },
        image: { type: String, default: '' }, // Base64 image
        text: { type: String, default: 'Welcome to Our Restaurant 🍽️ Spin & Win Your Reward!' },
        textColor: { type: String, default: '#ffffff' },
        overlayOpacity: { type: Number, default: 0.4, min: 0, max: 1 }
      },
      fields: {
        surname: {
          enabled: { type: Boolean, default: true },
          label: { type: String, default: 'Surname/Initial' },
          required: { type: Boolean, default: true }
        },
        name: {
          enabled: { type: Boolean, default: true },
          label: { type: String, default: 'Full Name' },
          required: { type: Boolean, default: true }
        },
        amountSpent: {
          enabled: { type: Boolean, default: true },
          label: { type: String, default: 'Amount Spent on Food' },
          required: { type: Boolean, default: true }
        },
        privacyPolicy: {
          enabled: { type: Boolean, default: true },
          text: { type: String, default: 'I agree to the privacy policy and terms of service' },
          policyText: {
            type: String,
            default: 'Your privacy is important to us. We collect and use your information only for the purpose of this promotion.'
          }
        }
      },
      // New: array of custom fields
      customFields: [{
        id: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, enum: ['text', 'number', 'email', 'tel'], default: 'text' },
        enabled: { type: Boolean, default: true },
        required: { type: Boolean, default: false },
        placeholder: { type: String, default: '' }
      }],
      submitButtonText: { type: String, default: 'Next' },
      backgroundColor: { type: String, default: '#ffffff' },
      textColor: { type: String, default: '#2c3e50' },
      buttonColor: { type: String, default: '#3498db' }
    },
    // New: session expiry duration in minutes
    sessionExpiryMinutes: { type: Number, default: 60, min: 0, max: 1440 }, // 0 = no expiry, else 1..1440
    // New: customizable thank you message
    thankYouMessage: { 
      type: String, 
      default: 'Thanks for Availing the Offer!',
      trim: true,
      maxlength: 200
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    collection: 'wheels',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

module.exports = mongoose.model('Wheel', WheelSchema);
