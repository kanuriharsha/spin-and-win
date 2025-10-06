import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import './pehsai.css';

const COLORS = ['#e74c3c', '#27ae60', '#f1c40f', '#3498db'];

const defaultNames = [
  'Alice','Bob','Charlie','Diana','Eve','Frank','Grace','Heidi',
  'Ivan','Judy','Mallory','Niaj'
];

function degToRad(d) {
  return (d * Math.PI) / 180;
}

function segmentPath(cx, cy, r, startDeg, endDeg) {
  const start = { x: cx + r * Math.cos(degToRad(startDeg)), y: cy + r * Math.sin(degToRad(startDeg)) };
  const end = { x: cx + r * Math.cos(degToRad(endDeg)), y: cy + r * Math.sin(degToRad(endDeg)) };
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export default function Pehsai() {
  const [names, setNames] = useState(defaultNames);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [centerImg, setCenterImg] = useState(null);
  const baseTurnsRef = useRef(0);
  const spinTimerRef = useRef(null);

  const segAngle = useMemo(() => (names.length > 0 ? 360 / names.length : 0), [names]);

  const onShuffle = () => {
    setNames((arr) => arr.map(v => ({ v, s: Math.random() })).sort((a,b) => a.s - b.s).map(({v}) => v));
  };

  const onSort = () => {
    setNames((arr) => [...arr].sort((a, b) => a.localeCompare(b)));
  };

  const onAddImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCenterImg(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Define onSpinEnd before pickSpin to avoid no-use-before-define, and memoize it
  const onSpinEnd = useCallback(() => {
    // Guard: run only once per spin
    if (!spinning) return;

    // Clear fallback timer if transitionend fired
    if (spinTimerRef.current) {
      clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
    }

    // Normalize rotation to [0,360)
    const norm = ((rotation % 360) + 360) % 360;
    // Angle at pointer = 0deg, so winner index is based on (360 - norm)
    const angleAtPointer = (360 - norm) % 360;
    const idx = Math.floor(angleAtPointer / segAngle) % names.length;
    setWinner(names[idx] || null);
    setSpinning(false);
    // Prevent unbounded growth
    baseTurnsRef.current = Math.floor(rotation / 360);
  }, [spinning, rotation, segAngle, names]);

  const pickSpin = useCallback(() => {
    if (spinning || names.length === 0) return;
    setWinner(null);
    setSpinning(true);

    const winIndex = Math.floor(Math.random() * names.length);
    // Center of the target segment (0deg is at the right, where pointer sits)
    const targetCenterDeg = winIndex * segAngle + segAngle / 2;
    // Rotate wheel so targetCenterDeg aligns with 0deg (pointer at right)
    baseTurnsRef.current += 5; // at least 5 full rotations for drama
    const targetRotation = baseTurnsRef.current * 360 + (360 - targetCenterDeg);
    setRotation(targetRotation);

    // Fallback: ensure onSpinEnd runs even if transitionend is missed
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      onSpinEnd();
    }, 4500 + 120); // CSS duration 4.5s + small buffer
  }, [names.length, segAngle, spinning, onSpinEnd]);

  // onSpinEnd is memoized above

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    };
  }, []);

  const vb = 1000;
  const cx = 500;
  const cy = 500;
  const r = 470;

  return (
    <div className="pehsai-layout">
      <div className="wheel-card">
        <div className="wheel-wrap">
          <div className="wheel-stage">
            <div
              className="wheel"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 4.5s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none'
              }}
              onTransitionEnd={onSpinEnd}
            >
              <svg width="100%" height="100%" viewBox={`0 0 ${vb} ${vb}`} role="img" aria-label="Spin & Win Wheel">
                <defs>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#00000033" />
                  </filter>
                </defs>
                <g filter="url(#shadow)">
                  {names.map((name, i) => {
                    const start = i * segAngle;
                    const end = (i + 1) * segAngle;
                    const mid = start + segAngle / 2;
                    const tx = cx + (r * 0.64) * Math.cos(degToRad(mid));
                    const ty = cy + (r * 0.64) * Math.sin(degToRad(mid));
                    return (
                      <g key={i}>
                        <path d={segmentPath(cx, cy, r, start, end)} fill={COLORS[i % COLORS.length]} />
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
                          {name}
                        </text>
                      </g>
                    );
                  })}
                  <circle cx={cx} cy={cy} r={70} fill="#ffffff" />
                </g>
              </svg>
              {centerImg && (
                <img className="center-logo" src={centerImg} alt="Center logo" />
              )}
            </div>
            <div className="pointer" aria-hidden />
          </div>

          <button
            className="spin-btn"
            onClick={pickSpin}
            disabled={spinning || names.length === 0}
            aria-label="Spin the wheel"
          >
            {spinning ? 'Spinning...' : 'SPIN'}
          </button>
          <div className="winner-banner" role="status">
            Winner: <strong>{winner || '-'}</strong>
          </div>
        </div>
      </div>

      <aside className="side-panel">
        <div className="controls">
          <button className="ctl-btn" onClick={onShuffle}>Shuffle</button>
          <button className="ctl-btn" onClick={onSort}>Sort</button>
          <label className="ctl-btn file-btn">
            Add Image
            <input type="file" accept="image/*" onChange={onAddImage} />
          </label>
        </div>
        <div className="list-box">
          {names.map((n, i) => (
            <div className="list-item" key={`${n}-${i}`}>
              <span className="dot" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="name">{n}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

