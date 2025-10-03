import React, { useState } from 'react';
import './FormPreview.css';

export default function FormPreview({ formConfig }) {
  const [formData, setFormData] = useState({
    surname: '',
    name: '',
    amountSpent: '',
    privacyAccepted: false
  });
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  if (!formConfig?.enabled) {
    return (
      <div className="form-preview-disabled">
        <h3>Entry form disabled</h3>
        <p>Enable the form to preview it here.</p>
      </div>
    );
  }

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="form-preview-container">
      <div
        className="form-preview"
        style={{
          backgroundColor: formConfig.backgroundColor,
          color: formConfig.textColor
        }}
      >
        <div className="form-header">
          <h2>{formConfig.title}</h2>
          <p>{formConfig.subtitle}</p>
        </div>

        <form className="entry-form">
          {formConfig.fields.surname.enabled && (
            <div className="form-field">
              <label>
                {formConfig.fields.surname.label}
                {formConfig.fields.surname.required && <span className="required">*</span>}
              </label>
              <input
                type="text"
                value={formData.surname}
                onChange={(e) => updateField('surname', e.target.value)}
                placeholder={`Enter ${formConfig.fields.surname.label.toLowerCase()}`}
              />
            </div>
          )}

          {formConfig.fields.name.enabled && (
            <div className="form-field">
              <label>
                {formConfig.fields.name.label}
                {formConfig.fields.name.required && <span className="required">*</span>}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder={`Enter ${formConfig.fields.name.label.toLowerCase()}`}
              />
            </div>
          )}

          {formConfig.fields.amountSpent.enabled && (
            <div className="form-field">
              <label>
                {formConfig.fields.amountSpent.label}
                {formConfig.fields.amountSpent.required && <span className="required">*</span>}
              </label>
              <input
                type="text"
                value={formData.amountSpent}
                onChange={(e) => updateField('amountSpent', e.target.value)}
                placeholder={`Enter ${formConfig.fields.amountSpent.label.toLowerCase()}`}
              />
            </div>
          )}

          {formConfig.fields.privacyPolicy.enabled && (
            <div className="form-field privacy-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.privacyAccepted}
                  onChange={(e) => updateField('privacyAccepted', e.target.checked)}
                />
                <span>{formConfig.fields.privacyPolicy.text}</span>
                <button
                  type="button"
                  className="privacy-link"
                  onClick={() => setShowPrivacyModal(true)}
                >
                  Privacy Policy
                </button>
              </label>
            </div>
          )}

          <button
            type="button"
            className="submit-btn"
            style={{ backgroundColor: formConfig.buttonColor }}
          >
            {formConfig.submitButtonText}
          </button>
        </form>
      </div>

      {showPrivacyModal && (
        <div className="privacy-modal-overlay">
          <div className="privacy-modal">
            <div className="privacy-modal-header">
              <h3>Privacy Policy</h3>
              <button className="close-btn" onClick={() => setShowPrivacyModal(false)}>
                ×
              </button>
            </div>
            <div className="privacy-modal-content">
              <p>{formConfig.fields.privacyPolicy.policyText}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
   
