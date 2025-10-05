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
// Use the same path logic as the editor preview
function segmentPath(cx, cy, r, startDeg, endDeg) {
  const start = { x: cx + r * Math.cos(degToRad(startDeg)), y: cy + r * Math.sin(degToRad(endDeg - (endDeg - startDeg))) };
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
  const [durSec, setDurSec] = useState(4.5);
  const spinTimerRef = useRef(null); // fallback timer
  // New: pre-spin name modal state (used if form is disabled)
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempSurname, setTempSurname] = useState('');
  // Happy sound audio context
  const audioCtxRef = useRef(null);

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

  // Use DB-configured base rotations (fallback 6, clamp 1..20)
  const baseTurnsCfg = Math.max(1, Math.min(20, Math.floor(Number(wheelData?.spinBaseTurns ?? 6))));

  // Sanitize to numeric-only for amount spent
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

  // Ensure numeric-only + error message
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
    if (config.amountSpent.enabled && config.amountSpent.required) {
      const v = String(formData.amountSpent ?? '').trim();
      const isNum = v !== '' && !Number.isNaN(Number(v));
      if (!isNum) {
        errors.amountSpent = 'Please enter the amount spent on food';
      }
    }
    if (config.privacyPolicy.enabled && !formData.privacyAccepted) {
      errors.privacyAccepted = 'Please accept the privacy policy to continue';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // New: small helper to play a short "Yay!" happy sound
  const playYay = () => {
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;

      const now = ctx.currentTime;
      // Two short chirps for a happy feel
      const freqs = [880, 1320, 1760];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.12);
        gain.gain.setValueAtTime(0.0001, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.2, now + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.3);
      });
    } catch (_) {
      // ignore sound errors silently
    }
  };

  // New: perform the actual spin (shared by button and modal confirm)
  const startSpin = async () => {
    if (spinning || hasSpun || !wheelData?.segments?.length) return;
    const segments = wheelData.segments;
    const segAngle = 360 / segments.length;
    // Determine duration: configured or random 3–5s
    const cfg = Number(wheelData?.spinDurationSec);
    const duration = Number.isFinite(cfg) && cfg >= 1 && cfg <= 60 ? cfg : (3 + Math.random() * 2);
    setDurSec(duration);

    setWinner(null);
    setShowWinnerModal(false);
    setSpinning(true);

    // Prefer server spin (rules + limits)
    let winIndex;
    if (sessionId) {
      try {
        const res = await fetch(`http://localhost:5000/api/wheels/${wheelData._id}/spin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId }
        });
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || 'Spin failed');
        }
        const data = await res.json();
        winIndex = Number(data.index);
      } catch (err) {
        console.error('Server spin failed:', err);
        alert('No eligible prizes right now. Please try again later.');
        setSpinning(false);
        return;
      }
    } else {
      // Client pick when no session (rules can't apply without amount)
      const total = segments.reduce((sum, s) => sum + (s.probability || 0), 0);
      if (total > 0) {
        let threshold = Math.random() * total;
        winIndex = 0;
        for (let i = 0; i < segments.length; i += 1) {
          threshold -= segments[i].probability || 0;
          if (threshold <= 0) { winIndex = i; break; }
        }
      } else {
        winIndex = Math.floor(Math.random() * segments.length);
      }
    }

    const targetCenter = winIndex * segAngle + segAngle / 2;
    baseTurnsRef.current += baseTurnsCfg; // use DB-configured base rotations
    setRotation(baseTurnsRef.current * 360 + (360 - targetCenter));

    // Fallback timer to ensure onSpinEnd fires
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      onSpinEnd();
    }, duration * 1000 + 150);
  };

  const handleSpin = () => {
    // If the form is disabled and we don't have a name/surname, ask before spinning
    const needNamePopup =
      !wheelData?.formConfig?.enabled &&
      (!formData.name?.trim() || !formData.surname?.trim());
    if (needNamePopup) {
      setTempName('');
      setTempSurname('');
      setShowNameModal(true);
      return;
    }
    startSpin();
  };

  const onSpinEnd = async () => {
    // Guard: run only once per spin
    if (!spinning) return;

    // Clear fallback timer if transitionend fired
    if (spinTimerRef.current) {
      clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
    }

    if (!wheelData?.segments?.length) return;
    const segments = wheelData.segments;
    const segAngle = 360 / segments.length;
    // Prefer the reserved math; compute prize by pointer
    const normalized = ((rotation % 360) + 360) % 360;
    const pointerAngle = (360 - normalized) % 360;
    const index = Math.floor(pointerAngle / segAngle) % segments.length;
    const prize = segments[index]?.text || null;

    setWinner(prize);
    setSpinning(false);
    setHasSpun(true);
    setShowWinnerModal(true);
    baseTurnsRef.current = Math.floor(rotation / 360) + 6;

    // Play happy sound
    playYay();

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

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    };
  }, []);

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
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={formData.amountSpent}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, amountSpent: e.target.value.replace(/[^\d.]/g, '') }))
                    }
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

  // geometry setup
  const segments = wheelData.segments || [];
  const segAngle = segments.length ? 360 / segments.length : 0;
  const vb = 1000;
  const cx = 500;
  const cy = 500;
  const r = 470;
  const centerR = Math.max(20, Math.min(160, Math.floor(Number(wheelData?.centerImageRadius ?? 70)))); // dynamic radius

  return (
    <div className="custom-wheel-page">
      <header className="wheel-header">
        <h1>{wheelData.name}</h1>
        <Link to="/dashboard" className="back-to-dashboard">Back to Dashboard</Link>
      </header>

      <div className="wheel-container">
        <div className="wheel-wrapper">
          <div className="wheel-stage preview-stage">
            <div
              className="wheel preview-wheel"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? `transform ${durSec}s cubic-bezier(0.23, 1, 0.32, 1)` : 'none',
                transformOrigin: '50% 50%',
                transformBox: 'fill-box'
              }}
              onTransitionEnd={onSpinEnd}
            >
              <svg width="100%" height="100%" viewBox={`0 0 ${vb} ${vb}`} role="img" aria-label="Spin & Win Wheel">
                <defs>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#00000033" />
                  </filter>
                  <clipPath id="preview-center-clip">
                    <circle cx={cx} cy={cy} r={centerR} />
                  </clipPath>
                </defs>
                <g filter="url(#shadow)">
                  {segments.map((segment, i) => {
                    const start = i * segAngle;
                    const end = (i + 1) * segAngle;
                    const mid = start + segAngle / 2;
                    const tx = cx + (r * 0.64) * Math.cos(degToRad(mid));
                    const ty = cy + (r * 0.64) * Math.sin(degToRad(mid));
                    const segPath = segmentPath(cx, cy, r, start, end);
                    return (
                      <g key={i}>
                        {/* Base colored slice */}
                        <path d={segPath} fill={segment.color} />
                        {/* Optional image clipped to this slice (no tiling) */}
                        {segment.image && (
                          <>
                            <clipPath id={`route-clip-seg-${i}`}>
                              <path d={segPath} />
                            </clipPath>
                            <image
                              href={segment.image}
                              x={cx - r}
                              y={cy - r}
                              width={2 * r}
                              height={2 * r}
                              preserveAspectRatio="xMidYMid slice"
                              clipPath={`url(#route-clip-seg-${i})`}
                              opacity="0.9"
                            />
                          </>
                        )}
                        {/* Text */}
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
                  {/* Center white base */}
                  <circle cx={cx} cy={cy} r={centerR} fill="#ffffff" />
                  {wheelData.centerImage && (
                    <>
                      <image
                        href={wheelData.centerImage}
                        x={cx - centerR}
                        y={cy - centerR}
                        width={centerR * 2}
                        height={centerR * 2}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath="url(#preview-center-clip)"
                      />
                      <circle cx={cx} cy={cy} r={centerR} fill="none" stroke="#ffffff" strokeWidth="4" />
                    </>
                  )}
                </g>
              </svg>
            </div>
            <div className="pointer" aria-hidden />
          </div>

          <button
            className="spin-btn"
            onClick={handleSpin}
            disabled={spinning || hasSpun || segments.length === 0}
            aria-label="Spin the wheel"
          >
            {spinning ? 'Spinning...' : hasSpun ? 'Already Spun' : 'SPIN'}
          </button>
          <div className="winner-banner" role="status">
            Winner: <strong>{winner || '-'}</strong>
          </div>
        </div>
      </div>

      {/* New: Pre-spin name modal (only shown if form is disabled) */}
      {showNameModal && (
        <div className="cw-modal-overlay" role="dialog" aria-modal="true">
          <div className="cw-modal">
            <div className="cw-modal-header">
              <h3>Enter your details</h3>
              <button className="cw-close-btn" onClick={() => setShowNameModal(false)}>×</button>
            </div>
            <div className="cw-modal-content">
              <div className="cw-field">
                <label>Full Name</label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="cw-field">
                <label>Surname / Initial</label>
                <input
                  type="text"
                  value={tempSurname}
                  onChange={(e) => setTempSurname(e.target.value)}
                  placeholder="Enter your surname"
                />
              </div>
            </div>
            <div className="cw-modal-actions">
              <button className="cancel-btn" onClick={() => setShowNameModal(false)}>Cancel</button>
              <button
                className="confirm-save-btn"
                onClick={() => {
                  const nameOk = tempName.trim().length > 0;
                  const surOk  = tempSurname.trim().length > 0;
                  if (!nameOk || !surOk) {
                    alert('Please enter your name and surname');
                    return;
                  }
                  // Store into formData so winner popup can personalize
                  setFormData((prev) => ({ ...prev, name: tempName.trim(), surname: tempSurname.trim() }));
                  setShowNameModal(false);
                  // Start spin now
                  startSpin();
                }}
              >
                Continue & Spin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New: Winner popup styled like the screenshot */}
      {showWinnerModal && (
        <div className="winner-toast-overlay" role="dialog" aria-modal="true">
          <div className="winner-toast" role="document">
            <div className="winner-toast-bar">We have a winner!</div>
            <div className="winner-toast-body">
              <div className="winner-name">
                {winner || '—'}
              </div>
              <div className="winner-subtext">
                {`${(formData.name || '').trim()} ${(formData.surname || '').trim()}`.trim() || 'Player'}
              </div>
              <div className="winner-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setShowWinnerModal(false)}
                >
                  Close
                </button>
                {/* Optional secondary action (disabled by default) */}
                {/* <button className="btn-primary" onClick={() => {/* custom action */ /*}}>Remove</button> */}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
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
//       </div>
//     </div>
//   );
// }
// }
