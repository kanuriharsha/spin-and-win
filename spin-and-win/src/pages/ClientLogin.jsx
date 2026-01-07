import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function ClientLogin() {
  const { clientLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await clientLogin(username.trim(), password);
      if (!res.ok) {
        setError(res.message || 'Invalid credentials');
        return;
      }
      // Redirect client directly to the wheel editor for their assigned wheel
      const wheelId = (res.clientData && (res.clientData.wheelId || res.clientData.clientId)) || null;
      if (!wheelId) {
        setError('No wheel assigned to this account. Please contact administrator.');
        return;
      }

      // Use production host for non-local environments
      const hostname = window.location.hostname || '';
      if (hostname.includes('localhost') || hostname === '127.0.0.1') {
        navigate(`/editor/${wheelId}`, { replace: true });
      } else {
        // Redirect full-page to deployed editor host
        window.location.href = `https://pehspinfinity.vercel.app/editor/${wheelId}`;
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit} autoComplete="off">
        <div className="auth-logo-container">
          <img src="/PEHSpinfinity.jpeg" alt="PEH Spinfinity Logo" className="auth-logo" />
          <div className="auth-brand">
            <h2 className="auth-company">PEH</h2>
            <h1 className="auth-title">Spinfinity</h1>
            <p className="auth-tagline">Client Portal</p>
          </div>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <label className="auth-field">
          <span>Client ID</span>
          <input
            name="user"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={loading}
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            name="pass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </label>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="auth-footer">
          <p className="auth-footer-link">Admin? <a href="/login">Login here</a></p>
        </div>

        <div className="auth-copyright">
          <p>© {currentYear} PEH Spinfinity. All rights reserved.</p>
        </div>
      </form>
    </div>
  );
}
