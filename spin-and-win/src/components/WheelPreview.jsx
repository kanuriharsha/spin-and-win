import React, { useState } from 'react';
import './WheelPreview.css';

// Helper function to convert degrees to radians
function degToRad(d) {
  return (d * Math.PI) / 180;
}

// Helper function to generate SVG path for a wheel segment
function segmentPath(cx, cy, r, startDeg, endDeg) {
  const start = { x: cx + r * Math.cos(degToRad(startDeg)), y: cy + r * Math.sin(degToRad(endDeg - (endDeg - startDeg))) };
  const end = { x: cx + r * Math.cos(degToRad(endDeg)), y: cy + r * Math.sin(degToRad(endDeg)) };
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export default function WheelPreview({ wheelData }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [durSec, setDurSec] = useState(4.5);

  const segments = wheelData.segments || [];
  const segAngle = segments.length > 0 ? 360 / segments.length : 0;
  const baseTurns = Math.max(1, Math.min(20, Math.floor(wheelData?.spinBaseTurns ?? 6)));

  const handleSpin = () => {
    if (spinning || segments.length === 0) return;
    setWinner(null);
    // Determine duration: configured or random 3–5s
    const cfg = Number(wheelData?.spinDurationSec);
    const duration = Number.isFinite(cfg) && cfg >= 1 && cfg <= 60 ? cfg : (3 + Math.random() * 2);
    setDurSec(duration);
    setSpinning(true);

    const winIndex = Math.floor(Math.random() * segments.length);
    const targetCenterDeg = winIndex * segAngle + segAngle / 2;
    const targetRotation = baseTurns * 360 + (360 - targetCenterDeg);
    setRotation(targetRotation);

    setTimeout(() => {
      setSpinning(false);
      setWinner(segments[winIndex]?.text || null);
    }, duration * 1000);
  };

  // Logical geometry for SVG viewBox
  const vb = 1000;
  const cx = 500;
  const cy = 500;
  const r = 470;
  const centerR = Math.max(20, Math.min(160, Math.floor(Number(wheelData?.centerImageRadius ?? 70)))) // dynamic radius

  return (
    <div className="wheel-preview-container">
      <div
        className="wheel-wrapper"
        // Use container (wrapper) color here
        style={{ backgroundColor: wheelData?.wrapperBackgroundColor || '#ffffff' }}
      >
        <div
          className="preview-stage"
          // New: wheel (inner stage) background color
          style={{ backgroundColor: wheelData?.wheelBackgroundColor || '#ffffff' }}
        >
          <div
            className="preview-wheel"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? `transform ${durSec}s cubic-bezier(0.23, 1, 0.32, 1)` : 'none'
            }}
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
                          <clipPath id={`preview-clip-seg-${i}`}>
                            <path d={segPath} />
                          </clipPath>
                          <image
                            href={segment.image}
                            x={cx - r}
                            y={cy - r}
                            width={2 * r}
                            height={2 * r}
                            preserveAspectRatio="xMidYMid slice"
                            clipPath={`url(#preview-clip-seg-${i})`}
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

                {/* Center image precisely at center */}
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
                    {/* subtle border for contrast */}
                    <circle cx={cx} cy={cy} r={centerR} fill="none" stroke="#ffffff" strokeWidth="4" />
                  </>
                )}
              </g>
            </svg>
          </div>
          <div className="preview-pointer" aria-hidden />
        </div>

        <button
          className="preview-spin-btn"
          onClick={handleSpin}
          disabled={spinning || segments.length === 0}
          aria-label="Spin the wheel"
        >
          {spinning ? 'Spinning...' : 'TEST SPIN'}
        </button>

        {winner && (
          <div className="preview-winner-banner" role="status">
            Winner: <strong>{winner}</strong>
          </div>
        )}
      </div>
    </div>
  );
}