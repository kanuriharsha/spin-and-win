import React, { useState } from 'react';
import './WheelPreview.css';

// Helper function to convert degrees to radians
function degToRad(d) {
  return (d * Math.PI) / 180;
}

// Helper function to generate SVG path for a wheel segment
function segmentPath(cx, cy, r, startDeg, endDeg) {
  const start = { x: cx + r * Math.cos(degToRad(startDeg)), y: cy + r * Math.sin(degToRad(startDeg)) };
  const end = { x: cx + r * Math.cos(degToRad(endDeg)), y: cy + r * Math.sin(degToRad(endDeg)) };
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export default function WheelPreview({ wheelData }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);

  const segments = wheelData.segments || [];
  const segAngle = segments.length > 0 ? 360 / segments.length : 0;

  const handleSpin = () => {
    if (spinning || segments.length === 0) return;
    
    setWinner(null);
    setSpinning(true);
    
    const winIndex = Math.floor(Math.random() * segments.length);
    // Calculate where to stop the wheel
    const targetCenterDeg = winIndex * segAngle + segAngle / 2;
    const spins = 5; // Full rotations for dramatic effect
    const targetRotation = spins * 360 + (360 - targetCenterDeg);
    
    setRotation(targetRotation);
    
    // Set winner after spin animation ends
    setTimeout(() => {
      setSpinning(false);
      setWinner(segments[winIndex]?.text || null);
    }, 4500); // Match transition duration
  };

  const size = 400; // px
  const vb = 1000;
  const cx = 500;
  const cy = 500;
  const r = 470;

  return (
    <div className="wheel-preview-container">
      <div className="wheel-wrapper">
        <div
          className="preview-wheel"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4.5s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none'
          }}
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
                    x={cx - r/2} 
                    y={cy - r/2} 
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
            <img className="preview-center-logo" src={wheelData.centerImage} alt="Center logo" />
          )}
        </div>

        <div className="preview-pointer" aria-hidden />
        
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