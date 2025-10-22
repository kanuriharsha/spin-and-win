import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import NotFound from './NotFound';
import './CustomWheel.css';

// ✅ Prefer localhost:5000, else REACT_APP_API_URL, else localhost:5000
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

// (removed unused helpers)

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
    // Custom fields will be added dynamically
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
  const audioCtxRef = useRef(null);
  
  // New: thank you state for already spun users
  const [showThankYou, setShowThankYou] = useState(false);
  const [previousWin, setPreviousWin] = useState(null);

  // (countdown UI removed when not displayed) — we keep expiry handling later without storing a visible counter

  // New: Generate device fingerprint
  const getDeviceFingerprint = () => {
    const stored = localStorage.getItem('deviceFingerprint');
    if (stored) return stored;
    
    const fingerprint = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${navigator.userAgent}`;
    localStorage.setItem('deviceFingerprint', fingerprint);
    return fingerprint;
  };

  // --- New: localStorage keys + helpers ---
  // Memoized storage keys so they are stable across renders and usable in effect deps
  const SESSION_KEY = useMemo(() => `sw_session_${String(routeName || '').toLowerCase()}`, [routeName]);
  const SPUN_KEY = useMemo(() => `sw_spun_${String(routeName || '').toLowerCase()}`, [routeName]);

  // Wrap storage helpers in useCallback so they can safely be used in effect deps
  const getLocalSpun = useCallback(() => {
    try {
      const raw = localStorage.getItem(SPUN_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj.expiresAt) return null;
      if (new Date(obj.expiresAt).getTime() <= Date.now()) {
        localStorage.removeItem(SPUN_KEY);
        return null;
      }
      return obj;
    } catch (_) {
      return null;
    }
  }, [SPUN_KEY]);

  const setLocalSpun = useCallback((payload = {}) => {
    try {
      // If server provided exact expiresAt, prefer it (store as-is)
      if (payload.expiresAt) {
        // Normalize to ISO string
        const normalized = new Date(payload.expiresAt).toISOString();
        localStorage.setItem(SPUN_KEY, JSON.stringify({ ...payload, expiresAt: normalized }));
        return;
      }

      // Determine configured minutes (0 = no expiry)
      const minutes = Number.isFinite(Number(wheelData?.sessionExpiryMinutes))
        ? Number(wheelData.sessionExpiryMinutes)
        : 60;

      if (minutes === 0) {
        // no expiry configured -> do not persist block
        try { localStorage.removeItem(SPUN_KEY); } catch (_) {}
        return;
      }

      // Use payload.outTime (server outTime) if present; otherwise use now
      const baseMs = payload.outTime ? new Date(payload.outTime).getTime() : Date.now();
      const expiresAt = new Date(baseMs + Number(minutes) * 60 * 1000).toISOString();
      const toStore = { ...payload, expiresAt };
      localStorage.setItem(SPUN_KEY, JSON.stringify(toStore));
    } catch (_) { /* ignore storage errors */ }
  }, [SPUN_KEY, wheelData?.sessionExpiryMinutes]);

  const getStoredSessionId = useCallback(() => {
    try {
      return localStorage.getItem(SESSION_KEY) || null;
    } catch (_) {
      return null;
    }
  }, [SESSION_KEY]);

  const persistSessionId = useCallback((id) => {
    try {
      if (id) localStorage.setItem(SESSION_KEY, id);
      else localStorage.removeItem(SESSION_KEY);
    } catch (_) { /* ignore */ }
  }, [SESSION_KEY]);
  // --- end local helpers ---

  useEffect(() => {
    // Fetch wheel first, then check local spun or server check
    let cancelled = false;
    // Reset transient UI flags to avoid stale flash from previous route/load
    setShowThankYou(false);
    setPreviousWin(null);
    setHasSpun(false);
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/wheels/route/${routeName}`);
        if (!res.ok) throw new Error('Wheel not found');
        const data = await res.json();
        if (cancelled) return;

        setWheelData({
          ...data,
          formConfig: mergeFormConfig(data.formConfig),
          segments: normalizeSegments(data.segments)
        });

        // Normalize expiry as integer (treat missing as 60)
        const expiry = Number.isFinite(Number(data.sessionExpiryMinutes)) ? Number(data.sessionExpiryMinutes) : 60;

        // If admin set sessionExpiryMinutes === 0 => no restriction.
        // IMPORTANT: remove any previously stored local spun marker for this route
        if (expiry === 0) {
          try { localStorage.removeItem(SPUN_KEY); } catch (_) {}
          // Also clear any stored session id so we don't reuse an old (already-spun) session
          try { persistSessionId(null); setSessionId(null); } catch(_) {}
          // show form according to config and short-circuit
          setShowForm(mergeFormConfig(data.formConfig).enabled);
          setLoading(false);
          return;
        }

        // Check local spun flag first (fast, avoids flicker)
        const local = getLocalSpun();
        if (local) {
          // include expiresAt so the countdown can be computed
          setPreviousWin({
            winner: local.winner,
            prizeAmount: local.prizeAmount,
            prizeType: local.prizeType,
            expiresAt: local.expiresAt,
            thankYouMessage: data.thankYouMessage
          });
          setShowThankYou(true);
          setShowForm(false);
          setLoading(false);
          return;
        }

        // Not spun locally => ask server
        const chk = await fetch(`${API_URL}/api/spin-results/check-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeName,
            deviceFingerprint: getDeviceFingerprint()
          })
        });
        const sessionData = await chk.json();
        if (cancelled) return;
        if (sessionData.hasSpun) {
          setPreviousWin(sessionData);
          setShowThankYou(true);
          setShowForm(false);
          // Persist local spun snapshot so subsequent refresh stays in "thank you"
          // If server returned expiresAt, pass it through so local expiration matches server
          setLocalSpun({
            winner: sessionData.winner,
            prizeAmount: sessionData.prizeAmount,
            prizeType: sessionData.prizeType,
            outTime: sessionData.outTime,
            expiresAt: sessionData.expiresAt // optional; setLocalSpun prefers this
          });
        } else {
          // If server says not spun, keep form flow based on form enabled
          setShowForm(mergeFormConfig(data.formConfig).enabled);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error loading wheel:', err);
        setError(err.message);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [routeName, SPUN_KEY, getLocalSpun, persistSessionId, setLocalSpun]);

  // Ensure sessionId persists across refreshes (still okay, but ensureSession will decide whether to reuse)
  useEffect(() => {
    const stored = getStoredSessionId();
    if (stored) setSessionId(stored);
  }, [routeName, getStoredSessionId]);

  // Use DB-configured base rotations (fallback 6, clamp 1..20)
  const baseTurnsCfg = Math.max(1, Math.min(20, Math.floor(Number(wheelData?.spinBaseTurns ?? 6))));

  // Sanitize to numeric-only for amount spent
  const submitForm = async (evt) => {
    evt.preventDefault();
    if (!validateForm()) return;
    try {
      const deviceFingerprint = getDeviceFingerprint();
      const payload = {
        wheelId: wheelData._id,
        routeName,
        surname: formData.surname.trim(),
        name: formData.name.trim(),
        amountSpent: formData.amountSpent.trim()
      };
      (wheelData.formConfig.customFields || []).forEach(field => {
        if (field.enabled) {
          payload[field.id] = (formData[field.id] || '').trim();
        }
      });

      const response = await fetch(`${API_URL}/api/spin-results/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, sessionId: deviceFingerprint })
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setSessionId(data.sessionId);
      persistSessionId(data.sessionId); // persist so refreshes keep the session
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
    
    // New: validate custom fields
    (wheelData.formConfig.customFields || []).forEach(field => {
      if (field.enabled && field.required && !String(formData[field.id] || '').trim()) {
        errors[field.id] = `${field.label} is required`;
      }
    });
    
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

  // New: play clapping sound after reward granted
  const playClapping = () => {
    try {
      const audio = new window.Audio(`${process.env.PUBLIC_URL}/Clapping.mp3`);
      audio.volume = 0.8;
      audio.play();
    } catch (_) {
      // ignore sound errors silently
    }
  };

  // Ensure a session exists even when the form is disabled
  const ensureSession = useRef(null);
  ensureSession.current = async () => {
    if (sessionId) return sessionId;
    if (!wheelData?._id) return null;

    // Try stored session first **only if wheel does not have infinite sessions**
    const stored = getStoredSessionId();
    const expiry = Number.isFinite(Number(wheelData?.sessionExpiryMinutes)) ? Number(wheelData.sessionExpiryMinutes) : 60;
    if (stored && expiry !== 0) {
      setSessionId(stored);
      return stored;
    }

    try {
      const res = await fetch(`${API_URL}/api/spin-results/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wheelId: wheelData._id,
          routeName,
          surname: (formData.surname || tempSurname || '').trim(),
          name: (formData.name || tempName || '').trim(),
          amountSpent: (formData.amountSpent || '').trim()
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSessionId(data.sessionId);
      persistSessionId(data.sessionId);
      return data.sessionId;
    } catch (e) {
      console.error('Failed to create session:', e);
      return null;
    }
  };

  // Perform the actual spin (server-first)
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

    let winIndex;

    // Always prefer server spin; create a session if needed
    let sid = sessionId;
    if (!sid) {
      sid = await ensureSession.current();
    }

    if (sid) {
      try {
        const res = await fetch(`${API_URL}/api/wheels/${wheelData._id}/spin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-session-id': sid }
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
      // Fallback to client pick (rare)
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
    baseTurnsRef.current += baseTurnsCfg;
    setRotation(baseTurnsRef.current * 360 + (360 - targetCenter));

    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      onSpinEnd();
    }, duration * 1000 + 150);
  };

  const handleSpin = () => {
    // When form is disabled, spin immediately without prompting for details
    startSpin();
  };

  // onSpinEnd: after result saved, persist local spun snapshot to block future forms until expiry
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
    const segment = segments[index];
    const prizeText = segment?.text || null;
    const prizeAmount = segment?.amount || '';
    const prizeType = segment?.prizeType || 'other';

    setWinner({ text: prizeText, amount: prizeAmount, type: prizeType });
    setSpinning(false);
    setHasSpun(true);
    setShowWinnerModal(true);
    baseTurnsRef.current = Math.floor(rotation / 360) + 6;

    // Play happy sound
    playYay();
    // Play clapping sound after reward granted
    playClapping();

    // Persist local spun flag so refresh shows Thank You immediately
    // Use the spin outTime so computed expiry aligns with server-side policy
    setLocalSpun({ winner: prizeText, prizeAmount, prizeType, outTime: new Date().toISOString() });

    // Attempt to save result to server (if session exists)
    if (sessionId && prizeText) {
      try {
        await fetch(`${API_URL}/api/spin-results/session/${sessionId}/result`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            winner: prizeText,
            prizeType: prizeType,
            prizeAmount: prizeAmount
          })
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

  // Start/stop expiry watcher when thank-you view is active and expiresAt is present
  useEffect(() => {
    if (!showThankYou || !previousWin?.expiresAt) return undefined;

    const expiryMs = new Date(previousWin.expiresAt).getTime();
    const tick = () => {
      const diffSec = Math.ceil((expiryMs - Date.now()) / 1000);
      if (diffSec <= 0) {
        // expired: clear local marker and show form so the user can spin again
        try { localStorage.removeItem(SPUN_KEY); } catch (_) {}
        // ALSO clear stored session id so we do not reuse an old session that already has a winner
        try { persistSessionId(null); setSessionId(null); } catch (_) {}
        setShowThankYou(false);
        setPreviousWin(null);
        setShowForm(true);
      }
    };

    // run immediately and then every second until expiry
    tick();
    let intervalId = setInterval(tick, 1000);
    return () => { clearInterval(intervalId); };
  }, [showThankYou, previousWin?.expiresAt, SPUN_KEY, persistSessionId]);

  if (loading) {
    return <div className="loading-container">Loading wheel...</div>;
  }

  if (error) {
    return <NotFound />;
  }

  // New: Show thank you screen if already spun
  if (showThankYou && previousWin) {
    const thankYouText = previousWin.thankYouMessage || wheelData?.thankYouMessage || 'Thanks for Availing the Offer!';
    
    return (
      <div className="custom-wheel-page">
        <div className="thank-you-container">
          <div className="thank-you-card">
            <div className="thank-you-icon">🎉</div>
            <h1>{thankYouText}</h1>
            <p className="thank-you-message">
              You've already received your prize: <strong>{previousWin.winner}</strong>
              {previousWin.prizeAmount && <span> </span>}
            </p>

            {/* Session expiry / countdown info */}
            {/* <div className="session-info" aria-live="polite">
              {timeLeftSec == null ? (
                <span>Session info not available</span>
              ) : timeLeftSec > 0 ? (
                <span>Next spin in <strong>{formatTime(timeLeftSec)}</strong></span>
              ) : (
                <span>Your session has expired — you can spin again now.</span>
              )}
            </div> */}

            <div className="previous-win-details text-center">
  <p>
    Concept powered by{' '}
    <strong><a
      href="https://umasai2465.wixsite.com/peh-network-hub"
      target="_blank"
      rel="noopener noreferrer"
  className="text-red-600 font-bold no-underline hover:text-red-700"
    >
      PEH Network Hub
    </a>
    </strong>
  </p>
</div>


          </div>
        </div>
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
            {/* New: Hero Banner */}
            {config.heroBanner?.enabled && config.heroBanner?.image && (
              <div className="hero-banner" style={{
                position: 'relative',
                width: 'calc(100% + clamp(48px, 12vw, 80px))',
                marginLeft: 'calc(-1 * clamp(24px, 6vw, 40px))',
                marginTop: 'calc(-1 * clamp(24px, 6vw, 40px))',
                marginBottom: 'clamp(24px, 6vw, 32px)',
                height: 'clamp(220px, 60vw, 280px)',
                borderRadius: 'clamp(18px, 4vw, 18px)',
                overflow: 'hidden',
                backgroundImage: `url(${config.heroBanner.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: `rgba(0, 0, 0, ${config.heroBanner.overlayOpacity ?? 0.4})`
                }} />
                <div style={{
                  position: 'relative',
                  zIndex: 1,
                  color: config.heroBanner.textColor || '#ffffff',
                  fontSize: 'clamp(20px, 6vw, 28px)',
                  fontWeight: 700,
                  textAlign: 'center',
                  padding: '0 clamp(16px, 4vw, 24px)',
                  textShadow: '0 2px 12px rgba(0, 0, 0, 0.6)',
                  lineHeight: 1.3,
                  maxWidth: '90%'
                }}>
                  {config.heroBanner.text || 'Welcome to Our Restaurant 🍽️'}
                </div>
              </div>
            )}

            <div className="form-header">
              <h1>{config.title}</h1>
              <p>{config.subtitle}</p>
            </div>
            
            {/* Display intro text if present */}
            {config.introText && (
              <div className="form-intro-text" style={{ 
                padding: '14px 18px', 
                marginBottom: '20px', 
                backgroundColor: 'rgba(37, 99, 235, 0.1)', 
                borderLeft: '4px solid #2563eb',
                borderRadius: '6px',
                fontSize: 'clamp(14px, 3.5vw, 15px)',
                lineHeight: '1.6',
                color: config.textColor || '#2c3e50'
              }}>
                {config.introText}
              </div>
            )}
            
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

              {/* New: Render custom fields */}
              {(config.customFields || []).map((customField) => 
                customField.enabled && (
                  <div className={`form-field ${formErrors[customField.id] ? 'error' : ''}`} key={customField.id}>
                    <label>
                      {customField.label}
                      {customField.required && <span className="required">*</span>}
                    </label>
                    <input
                      type={customField.type}
                      value={formData[customField.id] || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [customField.id]: e.target.value }))}
                      placeholder={customField.placeholder || `Enter ${customField.label.toLowerCase()}`}
                    />
                    {formErrors[customField.id] && <span className="error-message">{formErrors[customField.id]}</span>}
                  </div>
                )
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
        <div className="wheel-title">
          <h1>{wheelData.name}</h1>
          {wheelData.description?.trim() ? (
            <p className="wheel-subheading">
              {wheelData.description}
            </p>
          ) : null}
        </div>
        {/* <Link to="/dashboard" className="back-to-dashboard">Back to Dashboard</Link> */}
      </header>

      <div className="wheel-container">
        <div
          className="wheel-wrapper"
          // Use container (wrapper) color here
          style={{ backgroundColor: (wheelData && wheelData.wrapperBackgroundColor) || '#fff' }}
        >
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
            Winner: <strong>{winner?.text || '-'}</strong>
            {winner?.amount && <span> </span>}
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
        <div
          className="winner-toast-overlay"
          role="dialog"
          aria-modal="true"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('${process.env.PUBLIC_URL}/fireworks-15757.gif')`,
            backgroundSize: '100% 100%, cover',
            backgroundRepeat: 'no-repeat, no-repeat',
            backgroundPosition: 'center, center'
          }}
        >
          <div className="winner-toast" role="document">
          <div
  className="winner-toast-bar"
  style={{
    background: 'linear-gradient(90deg, #ffcc33, #ff6600)',
    color: '#fff',
    padding: '10px 15px',
    borderRadius: '10px',
    fontWeight: 600,
    textAlign: 'center',
    fontSize: '1.1rem',
    boxShadow: '0 0 10px rgba(255, 165, 0, 0.7)',
  }}
>
  🎉 Congrats{' '}
  <span
    style={{
      color: '#000',
      fontWeight: 700,
      textShadow: '0 0 6px rgba(255, 255, 255, 0.8)',
      fontFamily: 'Poppins, sans-serif',
    }}
  >
    {`${(formData.name || '').trim()} ${(formData.surname || '').trim()}`.trim() || 'Player'}
  </span>{' '}
  🎉 You've won!
</div>

            <div className="winner-toast-body">
              <div className="winner-name">
                {winner?.text || '—'}
              </div>
              {/* {winner?.amount && (
                <div className="winner-amount" style={{ fontSize: '1.1rem', color: '#fbbf24', marginTop: '8px', fontWeight: 600 }}>
                  {winner.amount}
                </div>
              )} */}
              <div className="winner-subtext">
                <b>Thank you for availing the offer 🙏🏼 We hope to see you again!</b>
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
//   );
// }
// }
