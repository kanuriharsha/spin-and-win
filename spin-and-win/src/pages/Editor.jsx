import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChromePicker } from 'react-color';
import './Editor.css';
import WheelPreview from '../components/WheelPreview';
import FormPreview from '../components/FormPreview';

// ✅ API base from env → localhost in dev → same-origin in prod
const API_URL =
  (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) ||
  ((typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname === '::1'))
    ? 'http://localhost:5000'
    : '');

// const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const DEFAULT_FORM_CONFIG = {
  enabled: true,
  title: 'Enter Your Details',
  subtitle: 'Please fill in your information to spin the wheel',
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
  submitButtonText: 'Next',
  backgroundColor: '#ffffff',
  textColor: '#2c3e50',
  buttonColor: '#3498db'
};

const mergeFormConfig = (incoming = {}) => ({
  ...DEFAULT_FORM_CONFIG,
  ...incoming,
  fields: {
    ...DEFAULT_FORM_CONFIG.fields,
    ...(incoming.fields || {}),
    surname: { ...DEFAULT_FORM_CONFIG.fields.surname, ...(incoming.fields?.surname || {}) },
    name: { ...DEFAULT_FORM_CONFIG.fields.name, ...(incoming.fields?.name || {}) },
    amountSpent: { ...DEFAULT_FORM_CONFIG.fields.amountSpent, ...(incoming.fields?.amountSpent || {}) },
    privacyPolicy: { ...DEFAULT_FORM_CONFIG.fields.privacyPolicy, ...(incoming.fields?.privacyPolicy || {}) }
  }
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

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Treat 'undefined' as no id to avoid bad fetches
  const isEditMode = !!id && id !== 'undefined';

  const [activeTab, setActiveTab] = useState('wheel');
  const [wheelData, setWheelData] = useState({
    name: 'New Spinning Wheel',
    routeName: '',
    segments: [
      { text: 'Prize 1', color: '#e74c3c', image: null, dailyLimit: null, dailyRemaining: null },
      { text: 'Prize 2', color: '#27ae60', image: null, dailyLimit: null, dailyRemaining: null },
      { text: 'Prize 3', color: '#f1c40f', image: null, dailyLimit: null, dailyRemaining: null },
      { text: 'Prize 4', color: '#3498db', image: null, dailyLimit: null, dailyRemaining: null }
    ],
    centerImage: null,
    formConfig: DEFAULT_FORM_CONFIG,
    // New: persisted spin + center image config
    spinDurationSec: null,           // seconds (null => 3–5s random)
    spinBaseTurns: 6,                // full rotations before landing
    centerImageRadius: 70            // SVG radius for center image
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
          segments: Array.isArray(data.segments) ? data.segments : [],
          formConfig: mergeFormConfig(data.formConfig),
          // safe defaults
          spinDurationSec: (Number.isFinite(data.spinDurationSec) && data.spinDurationSec >= 1 && data.spinDurationSec <= 60) ? data.spinDurationSec : null,
          spinBaseTurns: Math.max(1, Math.min(20, Math.floor(Number(data.spinBaseTurns ?? 6)))),
          centerImageRadius: Math.max(20, Math.min(160, Math.floor(Number(data.centerImageRadius ?? 70))))
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
          const prevRemaining = Number.isFinite(segment.dailyRemaining) ? Math.floor(segment.dailyRemaining) : limit;
          return {
            ...segment,
            dailyLimit: limit,
            dailyRemaining: Math.min(limit, Math.max(0, prevRemaining))
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

  const handleAddSegment = () => {
    // Generate a color based on the segment index
    const colors = ['#e74c3c', '#27ae60', '#f1c40f', '#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
    const newColor = colors[wheelData.segments.length % colors.length];
    
    setWheelData({
      ...wheelData,
      segments: [
        ...wheelData.segments,
        { text: `Prize ${wheelData.segments.length + 1}`, color: newColor, image: null, dailyLimit: null, dailyRemaining: null }
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

  const validateForm = () => {
    const newErrors = {};
    
    if (!wheelData.name.trim()) {
      newErrors.name = 'Wheel name is required';
    }
    
    if (!wheelData.routeName.trim()) {
      newErrors.routeName = 'Custom URL is required';
    } else if (!/^[a-z0-9-]+$/i.test(wheelData.routeName)) {
      newErrors.routeName = 'URL can only contain letters, numbers, and hyphens';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    setSaving(true);

    const payload = {
      ...wheelData,
      segments: wheelData.segments,
      formConfig: mergeFormConfig(wheelData.formConfig)
    };

    const method = isEditMode ? 'PUT' : 'POST';
    const url = isEditMode 
      ? `${API_URL}/api/wheels/${id}` 
      : `${API_URL}/api/wheels`;

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
          <input
            type="text"
            value={wheelData.name}
            onChange={(e) => setWheelData({...wheelData, name: e.target.value})}
            className="wheel-name-input"
            placeholder="Wheel Name"
          />
        </div>
        <div className="editor-actions">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
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
        <button
          className={`tab-btn ${activeTab === 'form' ? 'active' : ''}`}
          onClick={() => setActiveTab('form')}
        >
          Entry Form
        </button>
      </div>

      <div className="editor-content">
        {activeTab === 'wheel' ? (
          <>
            <div className="left-panel">
              <WheelPreview wheelData={wheelData} />
              
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

                {/* New: center image size slider */}
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Center Image Size</label>
                  <input
                    type="range"
                    min="20"
                    max="160"
                    step="1"
                    value={wheelData.centerImageRadius ?? 70}
                    onChange={(e) =>
                      setWheelData(prev => ({
                        ...prev,
                        centerImageRadius: Math.max(20, Math.min(160, Math.floor(Number(e.target.value) || 70)))
                      }))
                    }
                  />
                  <small>{wheelData.centerImageRadius ?? 70}px radius</small>
                </div>
              </div>

              {/* New: Spin config (duration + base rotations) */}
              <div className="spin-duration-control">
                <h3>Spin Settings</h3>
                <div className="form-group">
                  <label>Spin Duration (seconds)</label>
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
                    placeholder="Leave empty for random 3–5s"
                  />
                  <small>Leave empty to use random 3–5 seconds.</small>
                </div>

                <div className="form-group">
                  <label>Base Rotations</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    value={wheelData.spinBaseTurns ?? 6}
                    onChange={(e) =>
                      setWheelData(p => ({ ...p, spinBaseTurns: Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 6))) }))
                    }
                  />
                  <small>How many full turns before the wheel lands.</small>
                </div>
              </div>
            </div>
            
            <div className="right-panel">
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
                    <label>Text</label>
                    <input
                      type="text"
                      value={wheelData.segments[activeSegmentIndex].text}
                      onChange={(e) => handleSegmentChange(activeSegmentIndex, 'text', e.target.value)}
                      placeholder="Enter segment text"
                    />
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
//                   className={errors.routeName ? 'error' : ''}
//                 />
//               </div>
//               {errors.routeName && <div className="error-message">{errors.routeName}</div>}
//             </div>
            
//             <div className="modal-actions">
//               <button 
//                 className="cancel-btn" 
//                 onClick={() => setSaveModalOpen(false)}
//                 disabled={saving}
//               >
//                 Cancel
//               </button>
//               <button 
//                 className="confirm-save-btn" 
//                 onClick={handleSave}
//                 disabled={saving}
//               >
//                 {saving ? 'Saving...' : 'Save Wheel'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

