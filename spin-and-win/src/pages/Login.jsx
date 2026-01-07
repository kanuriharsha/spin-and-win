import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const { login, clientLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState('');
  const from = location.state?.from || '/dashboard';
  const currentYear = new Date().getFullYear();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isClient) {
      const res = await clientLogin(username.trim(), password);
      if (!res.ok) {
        setError(res.message || 'Invalid client credentials');
        return;
      }
      const wheelId = res.clientData?.wheelId || res.clientData?.wheel?._id;
      navigate(wheelId ? `/editor/${wheelId}` : from, { replace: true });
      return;
    }

    const res = await login(username.trim(), password);
    if (!res.ok) {
      setError(res.message || 'Invalid credentials');
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit} autoComplete="off" aria-describedby="auth-help">
        <div className="auth-logo-container">
          <img src="/PEHSpinfinity.jpeg" alt="PEH Spinfinity Logo" className="auth-logo" />
          <div className="auth-brand">
            {/* <h2 className="auth-company">PEH</h2> */}
            <h1 className="auth-title">Spinfinity</h1>
            <p className="auth-tagline">{isClient ? 'Client Portal' : 'Admin Portal'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setIsClient(false)}
            className={`auth-toggle ${!isClient ? 'active' : ''}`}
            aria-pressed={!isClient}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => setIsClient(true)}
            className={`auth-toggle ${isClient ? 'active' : ''}`}
            aria-pressed={isClient}
          >
            Client
          </button>
        </div>

        <label className="auth-field">
          <span>Username</span>
          <input
            name="user"
            inputMode="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <div className="auth-pass">
            <input
              name="pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="toggle"
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling;
                if (input) input.type = input.type === 'password' ? 'text' : 'password';
              }}
              aria-label="Show or hide password"
            >👁</button>
          </div>
        </label>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <button type="submit" className="auth-submit">Sign in</button>

        {/* Toggle above selects admin vs client; no separate client link needed */}

        <div className="auth-copyright">
          <p>© {currentYear} PEH Spinfinity. All rights reserved.</p>
        </div>
      </form>
    </div>
  );
}
