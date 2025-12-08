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
        {/* New: Hero Banner */}
        {formConfig.heroBanner?.enabled && formConfig.heroBanner?.image && (
          <div className="hero-banner-preview" style={{
            position: 'relative',
            width: 'calc(100% + 48px)',
            marginLeft: '-24px',
            marginTop: '-28px',
            marginBottom: '24px',
            height: '240px',
            borderRadius: '14px 14px 0 0',
            overflow: 'hidden',
            backgroundImage: `url(${formConfig.heroBanner.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: `rgba(0, 0, 0, ${formConfig.heroBanner.overlayOpacity ?? 0.4})`
            }} />
            <div style={{
              position: 'relative',
              zIndex: 1,
              color: formConfig.heroBanner.textColor || '#ffffff',
              fontSize: 'clamp(18px, 5vw, 24px)',
              fontWeight: 700,
              textAlign: 'center',
              padding: '0 20px',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
              lineHeight: 1.3
            }}>
              {formConfig.heroBanner.text || 'Welcome to Our Restaurant 🍽️'}
            </div>
          </div>
        )}

        <div className="form-header">
          <h2>{formConfig.title}</h2>
          <p>{formConfig.subtitle}</p>
        </div>

        {/* Intro text */}
        {formConfig.introText && (
          <div className="form-intro-text" style={{ 
            padding: '12px 16px', 
            marginBottom: '16px', 
            backgroundColor: 'rgba(37, 99, 235, 0.1)', 
            borderLeft: '4px solid #2563eb',
            borderRadius: '4px',
            fontSize: '14px',
            lineHeight: '1.6',
            color: formConfig.textColor || '#2c3e50'
          }}>
            {formConfig.introText}
          </div>
        )}

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
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={formData.amountSpent}
                onChange={(e) => updateField('amountSpent', e.target.value.replace(/[^\d.]/g, ''))}
                placeholder={`Enter ${formConfig.fields.amountSpent.label.toLowerCase()}`}
              />
            </div>
          )}

          {/* New: Render custom fields */}
          {(formConfig.customFields || []).map((customField) => 
            customField.enabled && (
              <div className="form-field" key={customField.id}>
                <label>
                  {customField.label}
                  {customField.required && <span className="required">*</span>}
                </label>
                <input
                  type={customField.type}
                  value={formData[customField.id] || ''}
                  onChange={(e) => updateField(customField.id, e.target.value)}
                  placeholder={customField.placeholder || `Enter ${customField.label.toLowerCase()}`}
                />
              </div>
            )
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

