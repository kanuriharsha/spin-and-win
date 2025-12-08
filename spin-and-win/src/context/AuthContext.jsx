import React, { createContext, useContext, useMemo, useState } from 'react';

// Compute API_URL similarly to other pages
const API_URL = ((typeof window !== 'undefined') && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '::1'
))
  ? 'http://localhost:5000'
  : (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) || 'http://localhost:5000';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // In-memory only; resets on full page reload
  const [authed, setAuthed] = useState(false);

  const login = async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return { ok: false, message: data.message || 'Login failed' };
      setAuthed(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  };

  const logout = () => setAuthed(false);

  const value = useMemo(() => ({ authed, login, logout }), [authed]);
  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
