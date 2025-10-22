import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const from = location.state?.from || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
        <h1 className="auth-title">Welcome</h1>
        <p id="auth-help" className="auth-sub">Sign in to continue</p>

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
      </form>
    </div>
  );
}
