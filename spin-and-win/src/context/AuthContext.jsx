import React, { createContext, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [role, setRole] = useState(null); // 'admin' or 'client'
  const [clientData, setClientData] = useState(null); // For client: { clientId, username, routeName, wheelId }

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
      setRole('admin');
      setClientData(null);
      return { ok: true, role: 'admin' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  };

  const clientLogin = async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/client-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return { ok: false, message: data.message || 'Login failed' };
      setAuthed(true);
      setRole('client');
      setClientData({
        clientId: data.clientId,
        username: data.username,
        routeName: data.routeName,
        wheelId: data.wheelId
      });
      return { ok: true, role: 'client', clientData: data };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  };

  const navigate = useNavigate();

  const logout = () => {
    setAuthed(false);
    setRole(null);
    setClientData(null);
    // Redirect to login page on logout
    try {
      navigate('/login', { replace: true });
    } catch (e) {
      // If navigate isn't available for some reason, silently ignore
      console.warn('Logout: navigate failed', e);
    }
  };

  const value = useMemo(() => ({ 
    authed, 
    role, 
    clientData, 
    login, 
    clientLogin, 
    logout 
  }), [authed, role, clientData]);
  
  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
