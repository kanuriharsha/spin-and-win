import React from 'react';
import { Link } from 'react-router-dom';
import './NotFound.css';

export default function NotFound() {
  return (
    <div className="nf-wrap">
      <div className="nf-card" role="alert" aria-live="polite">
        <h1 className="nf-title">Page Not Found</h1>
        <p className="nf-sub">The page you are looking for does not exist</p>
        <div className="nf-actions">
          <Link to="/dashboard" className="nf-btn primary">Go to Dashboard</Link>
          <Link to="/" className="nf-btn">Go Home</Link>
        </div>
      </div>
    </div>
  );
}
