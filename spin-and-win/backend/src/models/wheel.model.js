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
    segments: [{
      text: { type: String, required: true },
      color: { type: String, required: true },
      image: { type: String }, // Base64 encoded image data
      probability: { type: Number, default: 1, min: 0 } // Probability weight
    }],
    centerImage: { type: String }, // Base64 encoded image data
    // Form configuration
    formConfig: {
      enabled: { type: Boolean, default: true },
      title: { type: String, default: 'Enter Your Details' },
      subtitle: { type: String, default: 'Please fill in your information to spin the wheel' },
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
      submitButtonText: { type: String, default: 'Next' },
      backgroundColor: { type: String, default: '#ffffff' },
      textColor: { type: String, default: '#2c3e50' },
      buttonColor: { type: String, default: '#3498db' }
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
