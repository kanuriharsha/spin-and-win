import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChromePicker } from 'react-color';
import './Editor.css';
import WheelPreview from '../components/WheelPreview';
import FormPreview from '../components/FormPreview';

// ✅ Prefer localhost:5000 (when app runs locally), else REACT_APP_API_URL, else localhost:5000
const API_URL =
  ((typeof window !== 'undefined') &&
   (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1'))
    ? 'http://localhost:5000'
    : (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) || 'http://localhost:5000';

const DEFAULT_FORM_CONFIG = {
  enabled: true,
  title: 'Enter Your Details',
  subtitle: 'Please fill in your information to spin the wheel',
  introText: '',
  heroBanner: {
    enabled: false,
    image: '',
    text: 'Welcome to Our Restaurant 🍽️ Spin & Win Your Reward!',
    textColor: '#ffffff',
    overlayOpacity: 0.4
  },
  fields: {
    surname: { enabled: true, label: 'Surname/Initial', required: true },
    name: { enabled: true, label: 'Full Name', required: true },
    amountSpent: { enabled: true, label: 'Amount Spent on Food', required: true },
    privacyPolicy: {
      enabled: true,
      text: 'I agree to the privacy policy and terms of service',
      policyText: 'Your privacy is important to us. We collect and use your information only for the purpose of this promotion.'
    }
  },
  customFields: [],
  submitButtonText: 'Next',
  backgroundColor: '#ffffff',
  textColor: '#2c3e50',
  buttonColor: '#3498db'
};

const mergeFormConfig = (incoming = {}) => ({
  ...DEFAULT_FORM_CONFIG,
  ...incoming,
  introText: incoming.introText !== undefined ? incoming.introText : DEFAULT_FORM_CONFIG.introText,
  heroBanner: {
    ...DEFAULT_FORM_CONFIG.heroBanner,
    ...(incoming.heroBanner || {})
  },
  fields: {
    ...DEFAULT_FORM_CONFIG.fields,
    ...(incoming.fields || {}),
    surname: { ...DEFAULT_FORM_CONFIG.fields.surname, ...(incoming.fields?.surname || {}) },
    name: { ...DEFAULT_FORM_CONFIG.fields.name, ...(incoming.fields?.name || {}) },
    amountSpent: { ...DEFAULT_FORM_CONFIG.fields.amountSpent, ...(incoming.fields?.amountSpent || {}) },
    privacyPolicy: { ...DEFAULT_FORM_CONFIG.fields.privacyPolicy, ...(incoming.fields?.privacyPolicy || {}) }
  },
  customFields: Array.isArray(incoming.customFields) ? incoming.customFields : []
});

// Helper: convert File -> dataURL
async function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// Helper: bytes of a dataURL base64 payload
function dataURLBytes(dataURL) {
  try {
    const base64 = String(dataURL || '').split(',')[1] || '';
    const padding = (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    return Math.ceil((base64.length * 3) / 4) - padding;
  } catch {
    return 0;
  }
}

// Helper: compress image into dataURL (JPEG) under target bytes and max dimension
async function compressImageToDataURL(file, { maxDim = 600, targetBytes = 800 * 1024 } = {}) {
  const srcDataURL = await fileToDataURL(file);
  const img = document.createElement('img');
  img.decoding = 'async';
  img.loading = 'eager';
  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = srcDataURL;
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const cw = Math.max(1, Math.floor(w * scale));
  const ch = Math.max(1, Math.floor(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, cw, ch);

  let q = 0.85;
  let out = canvas.toDataURL('image/jpeg', q);
  // Reduce quality until under target or a floor quality
  while (dataURLBytes(out) > targetBytes && q > 0.55) {
    q -= 0.05;
    out = canvas.toDataURL('image/jpeg', q);
  }
  return out;
}

// Add helper to create a safe id from label (minimal sanitization: keep label but forbid '.' and leading '$')
function labelToFieldId(label) {
  if (!label || !String(label).trim()) return `custom_${Date.now()}`;
  let id = String(label).trim();
  // Replace dots (invalid in MongoDB keys) and replace leading $ if present
  id = id.replace(/\./g, '_');
  if (id[0] === '$') id = `_${id.slice(1) || Date.now()}`;
  return id;
}

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, clientData, logout } = useAuth();
  const isClient = role === 'client';
  // Treat 'undefined' as no id to avoid bad fetches
  const isEditMode = !!id && id !== 'undefined';

  const [activeTab, setActiveTab] = useState('wheel');
  const [wheelData, setWheelData] = useState({
    name: 'New Spinning Wheel',
    description: '',
    routeName: '',
    segments: [
      { text: 'Prize 1', color: '#e74c3c', image: null, prizeType: 'other', amount: '', dailyLimit: null, dailyRemaining: null },
      { text: 'Prize 2', color: '#27ae60', image: null, prizeType: 'other', amount: '', dailyLimit: null, dailyRemaining: null },
      { text: 'Prize 3', color: '#f1c40f', image: null, prizeType: 'other', amount: '', dailyLimit: null, dailyRemaining: null },
      { text: 'Prize 4', color: '#3498db', image: null, prizeType: 'other', amount: '', dailyLimit: null, dailyRemaining: null }
    ],
    centerImage: null,
    formConfig: DEFAULT_FORM_CONFIG,
    spinDurationSec: null,
    spinBaseTurns: 6,
    centerImageRadius: 112,
    wheelBackgroundColor: '#ffffff',
    wrapperBackgroundColor: '#ffffff',
    sessionExpiryMinutes: 60,
    thankYouMessage: 'Thanks for Availing the Offer!', // New: default thank you message
    instagramUrl: '',
    googleReviewUrl: '',
    youtubeUrl: '',
    designLine: ''
  });
  
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  useEffect(() => {
    if (!isEditMode) return;
    fetch(`${API_URL}/api/wheels/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setWheelData({
          ...data,
          description: data.description || '',
          segments: Array.isArray(data.segments) ? data.segments : [],
          formConfig: mergeFormConfig(data.formConfig),
          spinDurationSec: (Number.isFinite(data.spinDurationSec) && data.spinDurationSec >= 1 && data.spinDurationSec <= 60) ? data.spinDurationSec : null,
          spinBaseTurns: Math.max(1, Math.min(20, Math.floor(Number(data.spinBaseTurns ?? 6)))),
          centerImageRadius: Math.max(112, Math.min(120, Math.floor(Number(data.centerImageRadius ?? 112)))),
          wheelBackgroundColor: data.wheelBackgroundColor || '#ffffff',
          wrapperBackgroundColor: data.wrapperBackgroundColor || '#ffffff',
          // allow 0 (no expiry) — do not force minimum 1 here
          sessionExpiryMinutes: Math.max(0, Math.min(1440, Math.floor(Number(data.sessionExpiryMinutes ?? 60)))),
            thankYouMessage: data.thankYouMessage || 'Thanks for Availing the Offer!', // New
            instagramUrl: data.instagramUrl || '',
            googleReviewUrl: data.googleReviewUrl || '',
            youtubeUrl: data.youtubeUrl || '',
            designLine: data.designLine || ''
        });
        setActiveSegmentIndex(0);
      })
      .catch((err) => {
        console.error('Error fetching wheel:', err);
        navigate('/dashboard');
      });
  }, [id, isEditMode, navigate]);

  const handleSegmentChange = (index, field, value) => {
    setWheelData((prev) => {
      const segments = prev.segments.map((segment, i) => {
        if (i !== index) return segment;
        // New: dailyLimit handling, empty => unlimited
        if (field === 'dailyLimit') {
          const raw = value;
          const isEmpty = raw === '' || raw === null || raw === undefined;
          if (isEmpty) {
            return { ...segment, dailyLimit: null, dailyRemaining: null };
          }
          const limit = Math.max(0, Math.floor(Number(raw) || 0));
          const limitChanged = segment.dailyLimit !== limit;
          const prevRemaining = Number.isFinite(segment.dailyRemaining) ? Math.floor(segment.dailyRemaining) : limit;
          return {
            ...segment,
            dailyLimit: limit,
            dailyRemaining: limitChanged ? limit : Math.min(limit, Math.max(0, prevRemaining))
          };
        }
        return { ...segment, [field]: value };
      });
      return { ...prev, segments };
    });
  };

  const handleFormConfigChange = (path, value) => {
    setWheelData((prev) => {
      const nextForm = mergeFormConfig(prev.formConfig);
      const keys = path.split('.');
      let cursor = nextForm;
      keys.slice(0, -1).forEach((key) => {
        cursor[key] = { ...(cursor[key] || {}) };
        cursor = cursor[key];
      });
      cursor[keys[keys.length - 1]] = value;
      return { ...prev, formConfig: nextForm };
    });
  };

  // New: Add custom field
  const handleAddCustomField = () => {
    setWheelData(prev => ({
      ...prev,
      formConfig: {
        ...prev.formConfig,
        customFields: [
          ...(prev.formConfig.customFields || []),
          {
            id: `custom_${Date.now()}`,
            label: 'Custom Field',
            type: 'text',
            enabled: true,
            required: false,
            placeholder: ''
          }
        ]
      }
    }));
  };

  // New: Remove custom field (fixed syntax)
  const handleRemoveCustomField = (index) => {
    setWheelData((prev) => ({
       ...prev,
       formConfig: {
         ...prev.formConfig,
         customFields: prev.formConfig.customFields.filter((_, i) => i !== index)
       }
    }));
  };

  // New: Update custom field
  const handleCustomFieldChange = (index, field, value) => {
    setWheelData(prev => ({
      ...prev,
      formConfig: {
        ...prev.formConfig,
        customFields: prev.formConfig.customFields.map((cf, i) => {
          if (i !== index) return cf;
          // Always derive id from label so "Field Label" becomes the DB key (as user requested)
          if (field === 'label') {
            const derivedId = labelToFieldId(value);
            return { ...cf, label: value, id: derivedId };
          }
          // Keep a fallback sanitization if id is ever edited programmatically
          if (field === 'id') {
            const sanitized = labelToFieldId(value);
            return { ...cf, id: sanitized };
          }
          return { ...cf, [field]: value };
        })
      }
    }));
  };

  const handleAddSegment = () => {
    // Generate a color based on the segment index
    const colors = ['#e74c3c', '#27ae60', '#f1c40f', '#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
    const newColor = colors[wheelData.segments.length % colors.length];
    
    setWheelData({
      ...wheelData,
      segments: [
        ...wheelData.segments,
        { text: `Prize ${wheelData.segments.length + 1}`, color: newColor, image: null, prizeType: 'other', amount: '', dailyLimit: null, dailyRemaining: null }
      ]
    });
    
    // Auto-select the new segment
    setActiveSegmentIndex(wheelData.segments.length);
  };

  const handleRemoveSegment = (index) => {
    if (wheelData.segments.length <= 2) {
      alert('A wheel must have at least 2 segments');
      return;
    }
    
    const newSegments = wheelData.segments.filter((_, i) => i !== index);
    setWheelData({ ...wheelData, segments: newSegments });
    
    // Adjust active index if needed
    if (activeSegmentIndex >= index && activeSegmentIndex > 0) {
      setActiveSegmentIndex(activeSegmentIndex - 1);
    }
  };

  const handleColorChange = (color) => {
    handleSegmentChange(activeSegmentIndex, 'color', color.hex);
  };

  const handleImageUpload = async (e, segmentIndex) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Use same cap for center/segment for now
      const maxDim = 600;
      const targetBytes = 800 * 1024; // ~800 KB
      const compressed = await compressImageToDataURL(file, { maxDim, targetBytes });

      if (segmentIndex !== undefined) {
        handleSegmentChange(segmentIndex, 'image', compressed);
      } else {
        setWheelData({ ...wheelData, centerImage: compressed });
      }
    } catch (err) {
      console.error('Image processing failed:', err);
      alert('Failed to process image. Please try a smaller image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveImage = (segmentIndex) => {
    if (segmentIndex !== undefined) {
      handleSegmentChange(segmentIndex, 'image', null);
    } else {
      setWheelData({ ...wheelData, centerImage: null });
    }
  };

  // Add: rules handlers
  const handleRuleChange = (segIdx, ruleIdx, field, value) => {
    setWheelData(prev => {
      const segs = Array.isArray(prev.segments) ? [...prev.segments] : [];
      if (segIdx < 0 || segIdx >= segs.length) return prev;

      const seg = segs[segIdx] || {};
      const rules = Array.isArray(seg.rules) ? [...seg.rules] : [];
      const next = { ...(rules[ruleIdx] || { op: '>', amount: 0, dailyLimit: 0 }) };

      if (field === 'op') next.op = String(value);
      if (field === 'amount') next.amount = value === '' ? '' : Math.max(0, Number(value) || 0);
      if (field === 'dailyLimit') next.dailyLimit = value === '' ? '' : Math.max(0, Number(value) || 0);

      rules[ruleIdx] = next;
      segs[segIdx] = { ...seg, rules };
      return { ...prev, segments: segs };
    });
  };

  const handleAddRule = (segIdx) => {
    setWheelData(prev => {
      const segs = Array.isArray(prev.segments) ? [...prev.segments] : [];
      if (segIdx < 0 || segIdx >= segs.length) return prev;

      const seg = segs[segIdx] || {};
      const rules = Array.isArray(seg.rules) ? [...seg.rules] : [];
      rules.push({ op: '>', amount: 0, dailyLimit: 0 });
      segs[segIdx] = { ...seg, rules };
      return { ...prev, segments: segs };
    });
  };

  const handleRemoveRule = (segIdx, ruleIdx) => {
    setWheelData(prev => {
      const segs = Array.isArray(prev.segments) ? [...prev.segments] : [];
      if (segIdx < 0 || segIdx >= segs.length) return prev;

      const seg = segs[segIdx] || {};
      const rules = Array.isArray(seg.rules) ? [...seg.rules] : [];
      if (ruleIdx >= 0 && ruleIdx < rules.length) rules.splice(ruleIdx, 1);
      segs[segIdx] = { ...seg, rules };
      return { ...prev, segments: segs };
    });
  };

  // Reworked validation -> return { ok, newErrors } (do NOT call setErrors here)
  const validateForm = () => {
    const newErrors = {};
    
    // Admin must supply wheel name and routeName; clients are not required
    if (!isClient) {
      if (!wheelData || !wheelData.name || !String(wheelData.name).trim()) {
        newErrors.name = 'Wheel name is required';
      }

      if (!wheelData || !wheelData.routeName || !String(wheelData.routeName).trim()) {
        newErrors.routeName = 'Custom URL is required';
      } else if (!/^[a-z0-9-]+$/i.test(wheelData.routeName)) {
        newErrors.routeName = 'URL can only contain letters, numbers, and hyphens';
      }
    }

    // Spin Duration: must be a finite number between 1 and 60
    const sd = wheelData?.spinDurationSec;
    if (!(Number.isFinite(Number(sd)) && Number(sd) >= 1 && Number(sd) <= 60)) {
      newErrors.spinDurationSec = 'Spin duration (1–60s) is required';
    }

    // Base rotations: integer 1..20
    const br = wheelData?.spinBaseTurns;
    if (!Number.isFinite(Number(br)) || Math.floor(Number(br)) < 1 || Math.floor(Number(br)) > 20) {
      newErrors.spinBaseTurns = 'Base rotations (1–20) is required';
    }

    // Session expiry: must be present (allow 0)
    const se = wheelData?.sessionExpiryMinutes;
    if (se === null || se === undefined || se === '') {
      newErrors.sessionExpiryMinutes = 'Session expiry (minutes) is required (0 = no expiry)';
    } else {
      const n = Number(se);
      if (!Number.isFinite(n) || n < 0 || n > 1440) {
        newErrors.sessionExpiryMinutes = 'Session expiry must be 0..1440';
      }
    }

    // Per-segment validation: Text, Prize Type and Amount required for every segment
    (wheelData?.segments || []).forEach((seg, idx) => {
      const label = (seg && seg.text && String(seg.text).trim()) ? seg.text : `Prize ${idx + 1}`;
      if (!seg || !seg.text || !String(seg.text).trim()) {
        newErrors[`segment_${idx}_text`] = `Text is required for "${label}"`;
      }
      if (!seg || !seg.prizeType || !String(seg.prizeType).trim()) {
        newErrors[`segment_${idx}_prizeType`] = `Prize type is required for "${label}"`;
      }
      if (!seg || !seg.amount || !String(seg.amount).trim()) {
        newErrors[`segment_${idx}_amount`] = `Amount/details are required for "${label}"`;
      }
    });

    // New: Validate custom field ids - uniqueness and pattern
    const ids = {};
    (wheelData.formConfig.customFields || []).forEach((cf, i) => {
      // skip disabled fields
      if (!cf || !cf.enabled) return;
      const id = String(cf.id || '').trim();
      if (!id) {
        newErrors[`custom_${i}_id`] = `Field key is required for custom field #${i + 1}`;
        return;
      }
      // disallow '.' and leading '$' to avoid invalid Mongo keys
      if (id.indexOf('.') !== -1 || id.charAt(0) === '$') {
        newErrors[`custom_${i}_id`] = `Field key "${id}" contains invalid characters (avoid '.' and leading '$')`;
      }
      if (ids[id]) {
        newErrors[`custom_${i}_id`] = `Field key "${id}" is duplicated. Each custom field must have a unique key`;
      }
      ids[id] = true;
      // If required, ensure label present
      if (cf.required && !String(cf.label || '').trim()) {
        newErrors[`custom_${i}_label`] = `Label is required for custom field key "${id}"`;
      }
    });

    return { ok: Object.keys(newErrors).length === 0, newErrors };
  };

  const handleSave = () => {
    const result = validateForm();
    const ok = result?.ok === true;
    const newErrors = result?.newErrors || {};

    if (!ok) {
      // update state so editor UI shows inline messages
      setErrors(newErrors);
      // build a readable alert summary
      const summaries = Object.values(newErrors).slice(0, 8); // safe: newErrors is object
      alert(`Please fix required fields before saving:\n\n- ${summaries.join('\n- ')}`);
      return;
    }

    setSaving(true);
    // clear any previous errors
    setErrors({});

    const payload = {
      ...wheelData,
      // Ensure hidden admin-only fields stay populated for clients by keeping current values
      name: wheelData.name,
      routeName: wheelData.routeName,
      segments: wheelData.segments,
      formConfig: mergeFormConfig(wheelData.formConfig)
    };

    const method = isEditMode ? 'PUT' : 'POST';
    const url = isEditMode
      ? `${API_URL}/api/wheels/${id}`
      : `${API_URL}/api/wheels`;

    // If client, submit as pending update and show success message
    if (isClient) {
      const clientUrl = `${API_URL}/api/client/submit-update`;
      // Build segmentUpdates array expected by the server
      const segmentUpdates = (wheelData.segments || []).map((seg, idx) => ({
        segmentIndex: idx,
        updatedData: {
          text: seg.text,
          color: seg.color,
          image: seg.image,
          prizeType: seg.prizeType,
          amount: seg.amount,
          dailyLimit: seg.dailyLimit,
          rules: seg.rules || []
        }
      }));

      // Also send current admin-only fields so backend can keep them unchanged
      const meta = {
        name: wheelData.name,
        routeName: wheelData.routeName,
        spinDurationSec: wheelData.spinDurationSec,
        spinBaseTurns: wheelData.spinBaseTurns,
        sessionExpiryMinutes: wheelData.sessionExpiryMinutes
      };

      fetch(clientUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'clientid': clientData?.clientId || '',
          'wheelid': clientData?.wheelId || id || '',
          'routename': clientData?.routeName || ''
        },
        body: JSON.stringify({ segmentUpdates, meta })
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body?.message || 'Failed to submit client update');
          return body;
        })
        .then(() => {
          setSaving(false);
          setSaveModalOpen(false);
          // Friendly confirmation for clients
          alert('All changes saved successfully');
        })
        .catch((err) => {
          console.error('Error submitting client update:', err);
          setSaving(false);
          alert(err.message || 'Failed to save your changes. Please try again.');
        });
      return;
    }

    // Admin flow: save directly
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?._id) {
          throw new Error(body?.message || 'Failed to save wheel');
        }
        return body;
      })
      .then((savedWheel) => {
        setSaving(false);
        setSaveModalOpen(false);
        navigate(`/editor/${savedWheel._id}`);
      })
      .catch(err => {
        console.error('Error saving wheel:', err);
        setSaving(false);
        alert(err.message || 'Failed to save your wheel. Please try again.');
      });
  };

  return (
    <div className="editor-layout">
      <header className="editor-header">
        <div className="editor-title">
          <h1>{isEditMode ? 'Edit Wheel' : 'Create New Wheel'}</h1>
          {!isClient && (
            <>
              <input
                type="text"
                value={wheelData.name}
                onChange={(e) => setWheelData({...wheelData, name: e.target.value})}
                className="wheel-name-input"
                placeholder="Wheel Name"
              />
              {/* New: wheel description field */}
              <input
                type="text"
                value={wheelData.description}
                onChange={(e) => setWheelData({ ...wheelData, description: e.target.value })}
                className="wheel-name-input"
                placeholder="Wheel Description (shown under the heading)"
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </div>
        <div className="editor-actions">
          {(() => {
            try {
              if (role !== 'client') {
                return (
                  <button className="back-btn" onClick={() => navigate('/dashboard')}>
                    Back to Dashboard
                  </button>
                );
              } else {
                // For clients, show logout button (AuthContext handles redirect)
                return (
                  <button className="back-btn" onClick={() => { logout(); }}>
                    Logout
                  </button>
                );
              }
            } catch (e) {
              return (
                <button className="back-btn" onClick={() => navigate('/dashboard')}>
                  Back to Dashboard
                </button>
              );
            }
          })()}
          <button className="save-btn" onClick={() => setSaveModalOpen(true)}>
            Save Wheel
          </button>
        </div>
      </header>
      
      <div className="editor-tabs">
        <button
          className={`tab-btn ${activeTab === 'wheel' ? 'active' : ''}`}
          onClick={() => setActiveTab('wheel')}
        >
          Wheel Settings
        </button>
        {!isClient && (
          <button
            className={`tab-btn ${activeTab === 'form' ? 'active' : ''}`}
            onClick={() => setActiveTab('form')}
          >
            Entry Form
          </button>
        )}
      </div>

      <div className="editor-content">
        {activeTab === 'wheel' ? (
          <>
            <div className="left-panel">
              {/* New: wrap preview with background color */}
              <div style={{ backgroundColor: wheelData.wheelBackgroundColor, borderRadius: 12, padding: 12 }}>
                <WheelPreview wheelData={wheelData} />
              </div>
            </div>

            <div className="right-panel">
              {/* Admin-only visual/design controls */}
              {!isClient && (
                <div className="design-controls">
                  <div className="form-group">
                    <label>Background Color</label>
                    <input
                      type="color"
                      value={wheelData.wheelBackgroundColor || '#ffffff'}
                      onChange={(e) => setWheelData(prev => ({ ...prev, wheelBackgroundColor: e.target.value }))}
                    />
                  </div>

                  {/* Container (wheel-wrapper) Background control */}
                  <div className="center-image-control">
                    <h3>Container Background</h3>
                    <div className="form-group">
                      <label>Container Color</label>
                      <input
                        type="color"
                        value={wheelData.wrapperBackgroundColor || '#ffffff'}
                        onChange={(e) => setWheelData(prev => ({ ...prev, wrapperBackgroundColor: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="center-image-control">
                    <h3>Wheel Center Image</h3>
                    {wheelData.centerImage ? (
                      <div className="image-preview-container">
                        <img src={wheelData.centerImage} alt="Center" className="image-preview" />
                        <button
                          className="remove-image-btn"
                          onClick={() => handleRemoveImage()}
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : (
                      <label className="upload-btn">
                        Upload Center Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e)}
                          hidden
                        />
                      </label>
                    )}

                    {/* center image size slider */}
                    <div className="form-group" style={{ marginTop: 12 }}>
                      <label>Center Image Size</label>
                      <input
                        type="range"
                        min="112"
                        max="120"
                        step="1"
                        value={wheelData.centerImageRadius ?? 112}
                        onChange={(e) =>
                          setWheelData(prev => ({
                            ...prev,
                            centerImageRadius: Math.max(112, Math.min(120, Math.floor(Number(e.target.value) || 112)))
                          }))
                        }
                      />
                      <small>{wheelData.centerImageRadius ?? 112}px radius (112–120px allowed)</small>
                    </div>
                  </div>

                  {/* Spin config (duration + base rotations) */}
                  <div className="spin-duration-control">
                    <h3>Spin Settings</h3>
                    <div className="form-group">
                      <label>
                        Spin Duration (seconds)
                        <span style={{ color: '#ef4444', marginLeft: 6 }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        step="0.1"
                        value={wheelData.spinDurationSec ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') { setWheelData(p => ({ ...p, spinDurationSec: null })); return; }
                          const n = Number(raw);
                          if (!Number.isFinite(n)) return;
                          setWheelData(p => ({ ...p, spinDurationSec: Math.max(1, Math.min(60, n)) }));
                        }}
                        placeholder="Enter duration in seconds (1-60)"
                        className={errors.spinDurationSec ? 'error' : ''}
                      />
                      {errors.spinDurationSec && <div className="error-message">{errors.spinDurationSec}</div>}
                      <small>Previously this could be left empty for random 3–5s; now required</small>
                    </div>

                    <div className="form-group">
                      <label>
                        Base Rotations
                        <span style={{ color: '#ef4444', marginLeft: 6 }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        step="1"
                        value={wheelData.spinBaseTurns ?? 6}
                        onChange={(e) =>
                          setWheelData(p => ({ ...p, spinBaseTurns: Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 6))) }))
                        }
                        className={errors.spinBaseTurns ? 'error' : ''}
                      />
                      {errors.spinBaseTurns && <div className="error-message">{errors.spinBaseTurns}</div>}
                      <small>How many full turns before the wheel lands.</small>
                    </div>

                    {/* Session Expiry */}
                    <div className="form-group">
                      <label>
                        Session Expiry (minutes)
                        <span style={{ color: '#ef4444', marginLeft: 6 }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1440"
                        step="1"
                        value={wheelData.sessionExpiryMinutes ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setWheelData(p => ({ ...p, sessionExpiryMinutes: null }));
                            return;
                          }
                          const n = Number(raw);
                          if (!Number.isFinite(n)) return;
                          setWheelData(p => ({ ...p, sessionExpiryMinutes: Math.max(0, Math.min(1440, Math.floor(n))) }));
                        }}
                        placeholder="0 = no expiry, enter minutes (required)"
                        className={errors.sessionExpiryMinutes ? 'error' : ''}
                      />
                      {errors.sessionExpiryMinutes && <div className="error-message">{errors.sessionExpiryMinutes}</div>}
                      <small>How long (in minutes) before a user can spin again from the same device. 0 = no expiry (users can spin unlimited times). Max 1440 (24 hours).</small>
                    </div>

                    {/* Thank You Message + design links */}
                    <div className="form-group">
                      <label>Thank You Message</label>
                      <input
                        type="text"
                        maxLength="200"
                        value={wheelData.thankYouMessage ?? 'Thanks for Availing the Offer!'}
                        onChange={(e) => setWheelData(p => ({ ...p, thankYouMessage: e.target.value.slice(0, 200) }))}
                        placeholder="Thanks for Availing the Offer!"
                      />
                      <small>Message shown when user has already spun (max 200 characters).</small>
                    </div>

                    <div className="form-group">
                      <label>Instagram Link</label>
                      <input
                        type="url"
                        value={wheelData.instagramUrl || ''}
                        onChange={(e) => setWheelData(p => ({ ...p, instagramUrl: e.target.value.slice(0, 500) }))}
                        placeholder="https://instagram.com/your-page"
                      />
                    </div>

                    <div className="form-group">
                      <label>Google Review Link</label>
                      <input
                        type="url"
                        value={wheelData.googleReviewUrl || ''}
                        onChange={(e) => setWheelData(p => ({ ...p, googleReviewUrl: e.target.value.slice(0, 500) }))}
                        placeholder="https://g.page/r/your-review-link"
                      />
                    </div>

                    <div className="form-group">
                      <label>YouTube Link</label>
                      <input
                        type="url"
                        value={wheelData.youtubeUrl || ''}
                        onChange={(e) => setWheelData(p => ({ ...p, youtubeUrl: e.target.value.slice(0, 500) }))}
                        placeholder="https://youtube.com/@your-channel"
                      />
                    </div>

                    <div className="form-group">
                      <label>Design Line (end card)</label>
                      <input
                        type="text"
                        maxLength="200"
                        value={wheelData.designLine || ''}
                        onChange={(e) => setWheelData(p => ({ ...p, designLine: e.target.value.slice(0, 200) }))}
                        placeholder="Rate us on Google to grab extra discount."
                      />
                      <small>Shown below the icons in the design section; wraps automatically.</small>
                    </div>
                  </div>
                </div>
              )}
              <div className="segments-header">
                <h2>Wheel Segments</h2>
                <button className="add-segment-btn" onClick={handleAddSegment}>
                  Add Segment
                </button>
              </div>

              <div className="segments-list">
                {wheelData.segments.map((segment, index) => (
                  <div 
                    className={`segment-item ${activeSegmentIndex === index ? 'active' : ''}`} 
                    key={index}
                    onClick={() => setActiveSegmentIndex(index)}
                  >
                    <div 
                      className="segment-color" 
                      style={{ backgroundColor: segment.color }}
                    />
                    <div className="segment-info">
                      <input
                        type="text"
                        value={segment.text}
                        onChange={(e) => handleSegmentChange(index, 'text', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="segment-text-input"
                        placeholder="Enter text"
                      />
                      <p className="segment-probability">
                        Limit: {segment.dailyLimit ?? 'Unlimited'}{segment.dailyLimit != null ? ` • Left: ${segment.dailyRemaining ?? segment.dailyLimit}` : ''}
                      </p>
                      {/* Inline segment errors: show text / prizeType / amount messages */}
                      {(errors[`segment_${index}_text`] || errors[`segment_${index}_prizeType`] || errors[`segment_${index}_amount`]) && (
                        <small className="error-message" style={{ marginTop: 6 }}>
                          {errors[`segment_${index}_text`] || errors[`segment_${index}_prizeType`] || errors[`segment_${index}_amount`]}
                        </small>
                      )}
                    </div>
                    <button 
                      className="remove-segment-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSegment(index);
                      }}
                      disabled={wheelData.segments.length <= 2}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              
              {wheelData.segments.length > 0 && (
                <div className="segment-editor">
                  <h3>Edit Segment</h3>
                  
                  <div className="form-group">
                    <label>
                      Text
                      <span style={{ color: '#ef4444', marginLeft: 6 }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={wheelData.segments[activeSegmentIndex].text}
                      onChange={(e) => handleSegmentChange(activeSegmentIndex, 'text', e.target.value)}
                      placeholder="Enter segment text"
                      className={errors[`segment_${activeSegmentIndex}_text`] ? 'error' : ''}
                    />
                    {errors[`segment_${activeSegmentIndex}_text`] && (
                      <div className="error-message">{errors[`segment_${activeSegmentIndex}_text`]}</div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>
                      Prize Type
                      <span style={{ color: '#ef4444', marginLeft: 6 }}>*</span>
                    </label>
                    <select
                      value={wheelData.segments[activeSegmentIndex].prizeType || 'other'}
                      onChange={(e) => handleSegmentChange(activeSegmentIndex, 'prizeType', e.target.value)}
                      className={errors[`segment_${activeSegmentIndex}_prizeType`] ? 'error' : ''}
                    >
                      <option value="cash">Cash Prize</option>
                      <option value="loyalty">Loyalty Points</option>
                      <option value="percentage">Percentage</option>
                      <option value="other">Other Prize</option>
                    </select>
                    {errors[`segment_${activeSegmentIndex}_prizeType`] && (
                      <div className="error-message">{errors[`segment_${activeSegmentIndex}_prizeType`]}</div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>
                      Amount/Details
                      <span style={{ color: '#ef4444', marginLeft: 6 }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={wheelData.segments[activeSegmentIndex].amount || ''}
                      onChange={(e) => handleSegmentChange(activeSegmentIndex, 'amount', e.target.value)}
                      placeholder={
                        wheelData.segments[activeSegmentIndex].prizeType === 'percentage'
                          ? 'e.g., 4% OFF'
                          : 'e.g., ₹500, 30 Loyalty Points'
                      }
                      className={errors[`segment_${activeSegmentIndex}_amount`] ? 'error' : ''}
                    />
                    {errors[`segment_${activeSegmentIndex}_amount`] && (
                      <div className="error-message">{errors[`segment_${activeSegmentIndex}_amount`]}</div>
                    )}
                    <small>
                      {wheelData.segments[activeSegmentIndex].prizeType === 'percentage'
                        ? 'Enter the percent like "4%"; the bill amount will be used to compute the discount.'
                        : 'Optional: Specify the prize amount or details (e.g., "₹500" or "30 Loyalty Points")'}
                    </small>
                  </div>
                  
                  <div className="form-group">
                    <label>Daily Limit (per day, optional)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Leave empty for unlimited"
                      value={wheelData.segments[activeSegmentIndex].dailyLimit ?? ''}
                      onChange={(e) => handleSegmentChange(activeSegmentIndex, 'dailyLimit', e.target.value)}
                    />
                    <small>
                      {wheelData.segments[activeSegmentIndex].dailyLimit == null
                        ? 'Unlimited: no daily restriction.'
                        : `Remaining today: ${wheelData.segments[activeSegmentIndex].dailyRemaining ?? wheelData.segments[activeSegmentIndex].dailyLimit}`}
                    </small>
                  </div>
                  
                  <div className="form-group">
                    <label>Color</label>
                    <div className="color-picker-container">
                      <div 
                        className="color-preview" 
                        style={{ backgroundColor: wheelData.segments[activeSegmentIndex].color }}
                        onClick={() => setColorPickerOpen(!colorPickerOpen)}
                      />
                      {colorPickerOpen && (
                        <div className="color-picker-popover">
                          <div 
                            className="color-picker-cover" 
                            onClick={() => setColorPickerOpen(false)}
                          />
                          <ChromePicker 
                            color={wheelData.segments[activeSegmentIndex].color} 
                            onChange={handleColorChange}
                            disableAlpha
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Image (Optional)</label>
                    {wheelData.segments[activeSegmentIndex].image ? (
                      <div className="image-preview-container">
                        <img 
                          src={wheelData.segments[activeSegmentIndex].image} 
                          alt="Segment" 
                          className="image-preview"
                        />
                        <button 
                          className="remove-image-btn" 
                          onClick={() => handleRemoveImage(activeSegmentIndex)}
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : (
                      <label className="upload-btn">
                        Upload Image
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleImageUpload(e, activeSegmentIndex)} 
                          hidden 
                        />
                      </label>
                    )}
                  </div>

                  {/* New: Rules configuration */}
                  <div className="form-group">
                    <label>Rules (based on Amount Spent)</label>
                    <div className="rules-list">
                      {(wheelData.segments[activeSegmentIndex].rules || []).map((rule, rIdx) => (
                        <div key={rIdx} className="rule-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <small>If amount</small>
                            <select
                              value={rule.op || '>'}
                              onChange={(e) => handleRuleChange(activeSegmentIndex, rIdx, 'op', e.target.value)}
                              style={{ width: '100%', minHeight: 44 }}
                            >
                              <option value=">">{'>'}</option>
                              <option value=">=">{'>='}</option>
                              <option value="<">{'<'}</option>
                              <option value="<=">{'<='}</option>
                              <option value="==">{'=='}</option>
                              <option value="!=">{'!='}</option>
                            </select>
                          </div>
                          <div>
                            <small>Threshold</small>
                            <input
                              type="number"
                              min="0"
                              value={rule.amount ?? ''}
                              onChange={(e) => handleRuleChange(activeSegmentIndex, rIdx, 'amount', e.target.value)}
                              placeholder="e.g., 1500"
                            />
                          </div>
                          <div>
                            <small>Set daily limit to</small>
                            <input
                              type="number"
                              min="0"
                              value={rule.dailyLimit ?? ''}
                              onChange={(e) => handleRuleChange(activeSegmentIndex, rIdx, 'dailyLimit', e.target.value)}
                              placeholder="0 to block, 1 to allow once"
                            />
                          </div>
                          <button
                            type="button"
                            className="remove-segment-btn"
                            onClick={() => handleRemoveRule(activeSegmentIndex, rIdx)}
                            aria-label="Remove rule"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="add-segment-btn"
                        onClick={() => handleAddRule(activeSegmentIndex)}
                      >
                        Add Rule
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="left-panel">
              <FormPreview formConfig={wheelData.formConfig} />
            </div>
            
            <div className="right-panel">
              <div className="form-config-editor">
                <h2>Entry Form Settings</h2>
                
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={wheelData.formConfig.enabled}
                      onChange={(e) => handleFormConfigChange('enabled', e.target.checked)}
                    />
                    Enable entry form
                  </label>
                </div>
                
                <div className="form-group">
                  <label>Form Title</label>
                  <input
                    type="text"
                    value={wheelData.formConfig.title}
                    onChange={(e) => handleFormConfigChange('title', e.target.value)}
                    placeholder="Enter form title"
                  />
                </div>
                
                <div className="form-group">
                  <label>Form Subtitle</label>
                  <input
                    type="text"
                    value={wheelData.formConfig.subtitle}
                    onChange={(e) => handleFormConfigChange('subtitle', e.target.value)}
                    placeholder="Enter form subtitle"
                  />
                </div>
                
                {/* New: Intro Text field */}
                <div className="form-group">
                  <label>Intro Text (shown above fields)</label>
                  <textarea
                    rows={3}
                    value={wheelData.formConfig.introText || ''}
                    onChange={(e) => handleFormConfigChange('introText', e.target.value)}
                    placeholder="Enter intro/mark text to display above form fields (optional)"
                  />
                  <small>This text will appear above all form fields</small>
                </div>
                
                {/* New: Hero Banner Section */}
                <div className="form-group" style={{ marginTop: 24, paddingTop: 24, borderTop: '2px solid #e5e7eb' }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#1f2937', fontSize: 18 }}>Hero Banner (Mobile Optimized)</h3>
                  
                  <label>
                    <input
                      type="checkbox"
                      checked={wheelData.formConfig.heroBanner?.enabled || false}
                      onChange={(e) => handleFormConfigChange('heroBanner.enabled', e.target.checked)}
                    />
                    Enable Hero Banner
                  </label>
                  
                  {wheelData.formConfig.heroBanner?.enabled && (
                    <>
                      <div style={{ marginTop: 16 }}>
                        <label>Banner Text</label>
                        <input
                          type="text"
                          value={wheelData.formConfig.heroBanner?.text || ''}
                          onChange={(e) => handleFormConfigChange('heroBanner.text', e.target.value)}
                          placeholder="Welcome to Our Restaurant 🍽️ Spin & Win Your Reward!"
                        />
                        <small>Large, bold text displayed over the banner image</small>
                      </div>
                      
                      <div style={{ marginTop: 16 }}>
                        <label>Text Color</label>
                        <input
                          type="color"
                          value={wheelData.formConfig.heroBanner?.textColor || '#ffffff'}
                          onChange={(e) => handleFormConfigChange('heroBanner.textColor', e.target.value)}
                        />
                      </div>
                      
                      <div style={{ marginTop: 16 }}>
                        <label>Overlay Darkness (0 = transparent, 1 = dark)</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={wheelData.formConfig.heroBanner?.overlayOpacity ?? 0.4}
                          onChange={(e) => handleFormConfigChange('heroBanner.overlayOpacity', Number(e.target.value))}
                        />
                        <small>{Math.round((wheelData.formConfig.heroBanner?.overlayOpacity ?? 0.4) * 100)}% darkness</small>
                      </div>
                      
                      <div style={{ marginTop: 16 }}>
                        <label>Banner Image</label>
                        {wheelData.formConfig.heroBanner?.image ? (
                          <div className="image-preview-container">
                            <img 
                              src={wheelData.formConfig.heroBanner.image} 
                              alt="Hero Banner" 
                              className="image-preview"
                              style={{ maxHeight: 150 }}
                            />
                            <button 
                              className="remove-image-btn" 
                              onClick={() => handleFormConfigChange('heroBanner.image', '')}
                            >
                              Remove Banner Image
                            </button>
                          </div>
                        ) : (
                          <label className="upload-btn">
                            Upload Banner Image
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                try {
                                  const compressed = await compressImageToDataURL(file, { maxDim: 1200, targetBytes: 500 * 1024 });
                                  handleFormConfigChange('heroBanner.image', compressed);
                                } catch (err) {
                                  console.error('Image processing failed:', err);
                                  alert('Failed to process image. Please try a smaller image.');
                                } finally {
                                  e.target.value = '';
                                }
                              }}
                              hidden 
                            />
                          </label>
                        )}
                        <small>Recommended: Wide restaurant/food image (1200x400px)</small>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="form-fields-config">
                  <div className="field-config">
                    <h4>Surname / Initial</h4>
                    <label>
                      <input
                        type="checkbox"
                        checked={wheelData.formConfig.fields.surname.enabled}
                        onChange={(e) => handleFormConfigChange('fields.surname.enabled', e.target.checked)}
                      />
                      Enable field
                    </label>
                    <input
                      type="text"
                      value={wheelData.formConfig.fields.surname.label}
                      onChange={(e) => handleFormConfigChange('fields.surname.label', e.target.value)}
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={wheelData.formConfig.fields.surname.required}
                        onChange={(e) => handleFormConfigChange('fields.surname.required', e.target.checked)}
                      />
                      Required
                    </label>
                  </div>

                  <div className="field-config">
                    <h4>Name</h4>
                    <label>
                      <input
                        type="checkbox"
                        checked={wheelData.formConfig.fields.name.enabled}
                        onChange={(e) => handleFormConfigChange('fields.name.enabled', e.target.checked)}
                      />
                      Enable field
                    </label>
                    <input
                      type="text"
                      value={wheelData.formConfig.fields.name.label}
                      onChange={(e) => handleFormConfigChange('fields.name.label', e.target.value)}
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={wheelData.formConfig.fields.name.required}
                        onChange={(e) => handleFormConfigChange('fields.name.required', e.target.checked)}
                      />
                      Required
                    </label>
                  </div>
                  
                  <div className="field-config">
                    <h4>Amount Spent</h4>
                    <label>
                      <input
                        type="checkbox"
                        checked={wheelData.formConfig.fields.amountSpent.enabled}
                        onChange={(e) => handleFormConfigChange('fields.amountSpent.enabled', e.target.checked)}
                      />
                      Enable field
                    </label>
                    <input
                      type="text"
                      value={wheelData.formConfig.fields.amountSpent.label}
                      onChange={(e) => handleFormConfigChange('fields.amountSpent.label', e.target.value)}
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={wheelData.formConfig.fields.amountSpent.required}
                        onChange={(e) => handleFormConfigChange('fields.amountSpent.required', e.target.checked)}
                      />
                      Required
                    </label>
                  </div>
                  
                  <div className="field-config">
                    <h4>Privacy Policy</h4>
                    <label>
                      <input
                        type="checkbox"
                        checked={wheelData.formConfig.fields.privacyPolicy.enabled}
                        onChange={(e) => handleFormConfigChange('fields.privacyPolicy.enabled', e.target.checked)}
                      />
                      Require policy acknowledgement
                    </label>
                    <input
                      type="text"
                      value={wheelData.formConfig.fields.privacyPolicy.text}
                      onChange={(e) => handleFormConfigChange('fields.privacyPolicy.text', e.target.value)}
                    />
                    <textarea
                      rows={5}
                      value={wheelData.formConfig.fields.privacyPolicy.policyText}
                      onChange={(e) => handleFormConfigChange('fields.privacyPolicy.policyText', e.target.value)}
                    />
                  </div>
                </div>

                {/* New: Custom Fields Section */}
                <div className="custom-fields-section">
                  <div className="custom-fields-header">
                    <h4>Custom Fields</h4>
                    <button 
                      type="button"
                      className="add-segment-btn"
                      onClick={handleAddCustomField}
                    >
                      Add Custom Field
                    </button>
                  </div>
                  
                  {(wheelData.formConfig.customFields || []).map((customField, index) => (
                    <div key={customField.id} className="field-config custom-field-item">
                      <div className="custom-field-header">
                        <h5>Custom Field {index + 1}</h5>
                        <button
                          type="button"
                          className="remove-segment-btn"
                          onClick={() => handleRemoveCustomField(index)}
                        >
                          ×
                        </button>
                      </div>
                      
                      <label>
                        <input
                          type="checkbox"
                          checked={customField.enabled}
                          onChange={(e) => handleCustomFieldChange(index, 'enabled', e.target.checked)}
                        />
                        Enable field
                      </label>
                      
                      <label>Field Label</label>
                      <input
                        type="text"
                        value={customField.label}
                        onChange={(e) => handleCustomFieldChange(index, 'label', e.target.value)}
                        placeholder="Enter field label"
                      />

                      {/* no derived key display — label itself becomes the stored DB key */}

                      <label>Field Type</label>
                      <select
                        value={customField.type}
                        onChange={(e) => handleCustomFieldChange(index, 'type', e.target.value)}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="email">Email</option>
                        <option value="tel">Phone</option>
                      </select>
                      
                      <label>Placeholder</label>
                      <input
                        type="text"
                        value={customField.placeholder || ''}
                        onChange={(e) => handleCustomFieldChange(index, 'placeholder', e.target.value)}
                        placeholder="Enter placeholder text"
                      />
                      
                      <label>
                        <input
                          type="checkbox"
                          checked={customField.required}
                          onChange={(e) => handleCustomFieldChange(index, 'required', e.target.checked)}
                        />
                        Required
                      </label>
                    </div>
                  ))}
                </div>

                <div className="form-styling">
                  <div className="form-group">
                    <label>Submit Button Text</label>
                    <input
                      type="text"
                      value={wheelData.formConfig.submitButtonText}
                      onChange={(e) => handleFormConfigChange('submitButtonText', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Background Color</label>
                    <input
                      type="color"
                      value={wheelData.formConfig.backgroundColor}
                      onChange={(e) => handleFormConfigChange('backgroundColor', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Text Color</label>
                    <input
                      type="color"
                      value={wheelData.formConfig.textColor}
                      onChange={(e) => handleFormConfigChange('textColor', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Button Color</label>
                    <input
                      type="color"
                      value={wheelData.formConfig.buttonColor}
                      onChange={(e) => handleFormConfigChange('buttonColor', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      {saveModalOpen && (
        <div className="modal-overlay">
          <div className="save-modal">
            <h2>Save Your Wheel</h2>

            {!isClient && (
              <div className="form-group">
                <label>Wheel Name</label>
                <input
                  type="text"
                  value={wheelData.name}
                  onChange={(e) => setWheelData({...wheelData, name: e.target.value})}
                  placeholder="Enter wheel name"
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <div className="error-message">{errors.name}</div>}
              </div>
            )}
            
            {!isClient && (
              <div className="form-group">
                <label>Custom URL</label>
                <div className="url-input-wrapper">
                  <span className="url-prefix">
                    {typeof window !== 'undefined' ? `${window.location.host}/` : '/'}
                  </span>
                  <input
                    type="text"
                    value={wheelData.routeName}
                    onChange={(e) => setWheelData({...wheelData, routeName: e.target.value})}
                    placeholder="my-wheel"
                    className={errors.routeName ? 'error' : ''}
                  />
                </div>
                {errors.routeName && <div className="error-message">{errors.routeName}</div>}
              </div>
            )}

            {/* NEW: show validation summary from editor so admin sees missing required fields here too */}
            {(errors.spinDurationSec || errors.spinBaseTurns || errors.sessionExpiryMinutes || Object.keys(errors).some(k => k.startsWith('segment_'))) && (
              <div style={{ marginTop: 12 }}>
                <div className="error-message">
                  Please fix required fields before saving:
                  <ul style={{ margin: '8px 0 0 18px' }}>
                    {errors.spinDurationSec && <li>{errors.spinDurationSec}</li>}
                    {errors.spinBaseTurns && <li>{errors.spinBaseTurns}</li>}
                    {errors.sessionExpiryMinutes && <li>{errors.sessionExpiryMinutes}</li>}
                    {Object.keys(errors).filter(k => k.startsWith('segment_')).map((k) => (
                      <li key={k}>{errors[k]}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button 
                className="cancel-btn" 
                onClick={() => setSaveModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                className="confirm-save-btn" 
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Wheel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

