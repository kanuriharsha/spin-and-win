import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import './CustomWheel.css';

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

const normalizeSegments = (segments = []) =>
  segments.map((segment) => {
    const weight = Number(segment?.probability);
    return {
      ...segment,
      probability: Number.isFinite(weight) && weight >= 0 ? weight : 1
    };
  });

function degToRad(d) {
  return (d * Math.PI) / 180;
}

function segmentPath(cx, cy, r, startDeg, endDeg) {
  const start = { x: cx + r * Math.cos(degToRad(startDeg)), y: cy + r * Math.sin(degToRad(startDeg)) };
  const end = { x: cx + r * Math.cos(degToRad(endDeg)), y: cy + r * Math.sin(degToRad(endDeg)) };
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

// Weighted random selection based on probabilities
const pickWeightedIndex = (segments) => {
  const total = segments.reduce((sum, segment) => sum + (segment.probability || 0), 0);
  if (total <= 0) return 0;
  let threshold = Math.random() * total;
  for (let i = 0; i < segments.length; i += 1) {
    threshold -= segments[i].probability || 0;
    if (threshold <= 0) return i;
  }
  return segments.length - 1;
};

const CONFETTI_COLORS = ['#f87171', '#34d399', '#60a5fa', '#fbbf24', '#a855f7', '#f97316'];

export default function CustomWheel() {
  const { routeName } = useParams();
  const [wheelData, setWheelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [formData, setFormData] = useState({
    surname: '',
    name: '',
    amountSpent: '',
    privacyAccepted: false
  });
  const [formErrors, setFormErrors] = useState({});
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [hasSpun, setHasSpun] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const baseTurnsRef = useRef(5);

  useEffect(() => {
    fetch(`http://localhost:5000/api/wheels/route/${routeName}`)
      .then((res) => {
        if (!res.ok) throw new Error('Wheel not found');
        return res.json();
      })
      .then((data) => {
        setWheelData({
          ...data,
          formConfig: mergeFormConfig(data.formConfig),
          segments: normalizeSegments(data.segments)
        });
        setShowForm(mergeFormConfig(data.formConfig).enabled);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading wheel:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [routeName]);

  const validateForm = () => {
    if (!wheelData?.formConfig) return true;
    const config = wheelData.formConfig.fields;
    const errors = {};
    if (config.surname.enabled && config.surname.required && !formData.surname.trim()) {
      errors.surname = `${config.surname.label} is required`;
    }
    if (config.name.enabled && config.name.required && !formData.name.trim()) {
      errors.name = `${config.name.label} is required`;
    }
    if (config.amountSpent.enabled && config.amountSpent.required && !formData.amountSpent.trim()) {
      errors.amountSpent = `${config.amountSpent.label} is required`;
    }
    if (config.privacyPolicy.enabled && !formData.privacyAccepted) {
      errors.privacyAccepted = 'Please accept the privacy policy to continue';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitForm = async (evt) => {
    evt.preventDefault();
    if (!validateForm()) return;
    try {
      const response = await fetch('http://localhost:5000/api/spin-results/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wheelId: wheelData._id,
          routeName,
          surname: formData.surname.trim(),
          name: formData.name.trim(),
          amountSpent: formData.amountSpent.trim()
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = await response.json();
      setSessionId(payload.sessionId);
      setShowForm(false);
      setWinner(null);
      setHasSpun(false);
      setShowWinnerModal(false);
      setRotation(0);
    } catch (err) {
      console.error('Form submission failed:', err);
      alert('Something went wrong. Please try again.');
    }
  };

  const handleSpin = () => {
    if (spinning || hasSpun || !wheelData?.segments?.length) return;
    const segments = wheelData.segments;
    const segAngle = 360 / segments.length;
    const winIndex = pickWeightedIndex(segments);
    const targetCenter = winIndex * segAngle + segAngle / 2;
    baseTurnsRef.current += 6;
    setWinner(null);
    setSpinning(true);
    setRotation(baseTurnsRef.current * 360 + (360 - targetCenter));
  };

  const onSpinEnd = async () => {
    if (!wheelData?.segments?.length) return;
    const segments = wheelData.segments;
    const segAngle = 360 / segments.length;
    const normalized = ((rotation % 360) + 360) % 360;
    const pointerAngle = (360 - normalized) % 360;
    const index = Math.floor(pointerAngle / segAngle) % segments.length;
    const prize = segments[index]?.text || null;
    setWinner(prize);
    setSpinning(false);
    setHasSpun(true);
    setShowWinnerModal(true);
    baseTurnsRef.current = Math.floor(rotation / 360) + 6;

    if (sessionId && prize) {
      try {
        await fetch(`http://localhost:5000/api/spin-results/session/${sessionId}/result`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ winner: prize })
        });
      } catch (err) {
        console.error('Failed to log spin result:', err);
      }
    }
  };

  if (loading) {
    return <div className="loading-container">Loading wheel...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Wheel Not Found</h2>
        <p>{error}</p>
        <Link to="/dashboard" className="back-link">Go to Dashboard</Link>
      </div>
    );
  }

  // ...existing render...
  if (showForm && wheelData.formConfig?.enabled) {
    const config = wheelData.formConfig;
    return (
      <div className="custom-wheel-page">
        <div
          className="entry-form-container"
          style={{ backgroundColor: config.backgroundColor, color: config.textColor }}
        >
          <div className="entry-form-wrapper">
            <div className="form-header">
              <h1>{config.title}</h1>
              <p>{config.subtitle}</p>
            </div>
            <form className="entry-form" onSubmit={submitForm}>
              {config.fields.surname.enabled && (
                <div className={`form-field ${formErrors.surname ? 'error' : ''}`}>
                  <label>
                    {config.fields.surname.label}
                    {config.fields.surname.required && <span className="required">*</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.surname}
                    onChange={(e) => setFormData((prev) => ({ ...prev, surname: e.target.value }))}
                    placeholder={`Enter ${config.fields.surname.label.toLowerCase()}`}
                  />
                  {formErrors.surname && <span className="error-message">{formErrors.surname}</span>}
                </div>
              )}
              {config.fields.name.enabled && (
                <div className={`form-field ${formErrors.name ? 'error' : ''}`}>
                  <label>
                    {config.fields.name.label}
                    {config.fields.name.required && <span className="required">*</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder={`Enter ${config.fields.name.label.toLowerCase()}`}
                  />
                  {formErrors.name && <span className="error-message">{formErrors.name}</span>}
                </div>
              )}
              {config.fields.amountSpent.enabled && (
                <div className={`form-field ${formErrors.amountSpent ? 'error' : ''}`}>
                  <label>
                    {config.fields.amountSpent.label}
                    {config.fields.amountSpent.required && <span className="required">*</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.amountSpent}
                    onChange={(e) => setFormData((prev) => ({ ...prev, amountSpent: e.target.value }))}
                    placeholder={`Enter ${config.fields.amountSpent.label.toLowerCase()}`}
                  />
                  {formErrors.amountSpent && <span className="error-message">{formErrors.amountSpent}</span>}
                </div>
              )}
              {config.fields.privacyPolicy.enabled && (
                <div className="form-field privacy-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.privacyAccepted}
                      onChange={(e) => setFormData((prev) => ({ ...prev, privacyAccepted: e.target.checked }))}
                    />
                    <span>{config.fields.privacyPolicy.text}</span>
                    <button type="button" className="privacy-link" onClick={() => setShowPrivacyModal(true)}>
                      Privacy Policy
                    </button>
                  </label>
                  {formErrors.privacyAccepted && (
                    <span className="error-message">{formErrors.privacyAccepted}</span>
                  )}
                </div>
              )}
              <button
                type="submit"
                className="submit-btn"
                style={{ backgroundColor: config.buttonColor }}
              >
                {config.submitButtonText}
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
                  <p>{config.fields.privacyPolicy.policyText}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const segments = wheelData.segments || [];
  const segAngle = segments.length ? 360 / segments.length : 0;
  const size = 520;
  const vb = 1000;
  const cx = 500;
  const cy = 500;
  const r = 470;

  return (
    <div className="custom-wheel-page">
      <header className="wheel-header">
        <h1>{wheelData.name}</h1>
        <Link to="/dashboard" className="back-to-dashboard">Back to Dashboard</Link>
      </header>

      <div className="wheel-container">
        <div className="wheel-wrapper">
          <div
            className="wheel"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4.5s cubic-bezier(0.23, 1, 0.32, 1)' : 'none',
              transformOrigin: '50% 50%',
              transformBox: 'fill-box'
            }}
            onTransitionEnd={onSpinEnd}
          >
            <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} role="img" aria-label="Spin & Win Wheel">
              <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#00000033" />
                </filter>
                {segments.map((segment, i) => segment.image && (
                  <pattern
                    key={i}
                    id={`segment-image-${i}`}
                    patternUnits="userSpaceOnUse"
                    width={r}
                    height={r}
                    patternTransform={`rotate(${i * segAngle + segAngle / 2} ${cx} ${cy})`}
                  >
                    <image
                      href={segment.image}
                      x={cx - r / 2}
                      y={cy - r / 2}
                      width={r}
                      height={r}
                      opacity="0.9"
                    />
                  </pattern>
                ))}
              </defs>
              <g filter="url(#shadow)">
                {segments.map((segment, i) => {
                  const start = i * segAngle;
                  const end = (i + 1) * segAngle;
                  const mid = start + segAngle / 2;
                  const tx = cx + (r * 0.64) * Math.cos(degToRad(mid));
                  const ty = cy + (r * 0.64) * Math.sin(degToRad(mid));

                  return (
                    <g key={i}>
                      <path
                        d={segmentPath(cx, cy, r, start, end)}
                        fill={segment.image ? `url(#segment-image-${i})` : segment.color}
                      />
                      <text
                        x={tx}
                        y={ty}
                        fill="#fff"
                        fontSize="44"
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${mid}, ${tx}, ${ty})`}
                        style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.25)', strokeWidth: 3 }}
                      >
                        {segment.text}
                      </text>
                    </g>
                  );
                })}
                <circle cx={cx} cy={cy} r={70} fill="#ffffff" />
              </g>
            </svg>

            {wheelData.centerImage && (
              <img className="center-logo" src={wheelData.centerImage} alt="Center logo" />
            )}
          </div>

          <div className="pointer" aria-hidden />

          <button
            className="spin-btn"
            onClick={handleSpin}
            disabled={spinning || hasSpun || segments.length === 0}
            aria-label="Spin the wheel"
          >
            {spinning ? 'Spinning...' : 'SPIN'}
          </button>
          <div className="winner-banner" role="status">
            Winner: <strong>{winner || '-'}</strong>
          </div>
        </div>
      </div>
      {showWinnerModal && (
        <div className="winner-modal-overlay" role="dialog" aria-modal="true">
          <div className="winner-modal">
            <h2>Congratulations!</h2>
            <p>You won <strong>{winner}</strong></p>
            <div className="confetti-wrap">
              {Array.from({ length: 40 }).map((_, idx) => (
                <span
                  key={idx}
                  className="confetti-piece"
                  style={{
                    left: `${(idx / 40) * 100}%`,
                    animationDelay: `${(idx % 10) * 0.12}s`,
                    backgroundColor: CONFETTI_COLORS[idx % CONFETTI_COLORS.length]
                  }}
                />
              ))}
            </div>
            <p className="winner-note">Please contact the host to claim your prize.</p>
          </div>
        </div>
      )}
    </div>
  );
}
//                         fill="#fff"
//                         fontSize="44"
//                         fontWeight="700"
//                         textAnchor="middle"
//                         dominantBaseline="middle"
//                         transform={`rotate(${mid}, ${tx}, ${ty})`}
//                         style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.25)', strokeWidth: 3 }}
//                       >
//                         {segment.text}
//                       </text>
//                     </g>
//                   );
//                 })}
//                 <circle cx={cx} cy={cy} r={70} fill="#ffffff" />
//               </g>
//             </svg>
            
//             {wheelData.centerImage && (
//               <img className="center-logo" src={wheelData.centerImage} alt="Center logo" />
//             )}
//           </div>

//           <div className="pointer" aria-hidden />
          
//           <button
//             className="spin-btn"
//             onClick={handleSpin}
//             disabled={spinning || segments.length === 0}
//             aria-label="Spin the wheel"
//           >
//             {spinning ? 'Spinning...' : 'SPIN'}
//           </button>
          
//           <div className="winner-banner" role="status">
//             Winner: <strong>{winner || '-'}</strong>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
