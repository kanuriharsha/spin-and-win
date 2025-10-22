import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './Analytics.css';

const API_URL =
  ((typeof window !== 'undefined') &&
   (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1'))
    ? 'http://localhost:5000'
    : (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) || 'http://localhost:5000';

export default function Analytics() {
  const [logins, setLogins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', password: '', routeName: '', access: 'enable', onboard: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', password: '', routeName: 'All', onboard: '', access: 'enable' });
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const navigate = useNavigate();

  const fetchLogins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/logins`);
      const data = await res.json();
      setLogins(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching logins:', err);
      setLoading(false);
      showMessage('error', 'Failed to load login data');
    }
  }, []);

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/wheels`);
      const data = await res.json();
      // map to routeName strings, include 'All' option
      const routes = Array.isArray(data) ? data.map(w => String(w.routeName || '')) : [];
      setAvailableRoutes(['All', ...Array.from(new Set(routes)).filter(r => r)]);
    } catch (err) {
      console.warn('Failed to load routes:', err);
    }
  }, []);

  useEffect(() => {
    fetchLogins();
    fetchRoutes();
  }, [fetchLogins, fetchRoutes]);


  const handleEdit = (login) => {
    setEditingId(login._id);
    setEditForm({
      username: login.username,
      password: login.password,
      routeName: login.routeName,
      access: login.access || 'enable',
      onboard: login.onboard ? new Date(login.onboard).toISOString().slice(0, 10) : ''
    });
    setMessage({ type: '', text: '' });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({ username: '', password: '', routeName: '', access: 'enable', onboard: '' });
    setMessage({ type: '', text: '' });
  };

  const handleSave = async (id) => {
    if (!editForm.username.trim() || !editForm.password.trim() || !editForm.routeName.trim()) {
      showMessage('error', 'All fields are required');
      return;
    }
    try {
      setSaving(true);
      // Send onboard as string (YYYY-MM-DD) so backend can convert to Date
      const payload = {
        username: editForm.username,
        password: editForm.password,
        routeName: editForm.routeName,
        access: editForm.access,
        onboard: editForm.onboard // string from input, e.g. "2025-10-14"
      };
      const res = await fetch(`${API_URL}/api/logins/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok && result.ok) {
        setLogins(logins.map(login => login._id === id ? result.data : login));
        setEditingId(null);
        setEditForm({ username: '', password: '', routeName: '', access: 'enable', onboard: '' });
        showMessage('success', 'Login updated successfully!');
      } else {
        showMessage('error', result.message || 'Failed to update login');
      }
    } catch (err) {
      console.error('Error updating login:', err);
      showMessage('error', 'Failed to update login');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAccess = async (id, currentAccess, isEdit = false) => {
    if (isEdit) {
      setEditForm(prev => ({
        ...prev,
        access: prev.access === 'enable' ? 'disable' : 'enable'
      }));
      return;
    }
    try {
      const newAccess = currentAccess === 'enable' ? 'disable' : 'enable';
      const loginObj = logins.find(l => l._id === id);
      const payload = {
        ...loginObj,
        access: newAccess,
        onboard: loginObj.onboard // preserve onboard
      };
      const res = await fetch(`${API_URL}/api/logins/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok && result.ok) {
        setLogins(logins.map(login => login._id === id ? result.data : login));
        showMessage('success', `Access ${newAccess}d successfully!`);
      } else {
        showMessage('error', result.message || 'Failed to update access');
      }
    } catch (err) {
      console.error('Error toggling access:', err);
      showMessage('error', 'Failed to update access');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!createForm.username.trim() || !createForm.password.trim() || !createForm.routeName.trim()) {
      showMessage('error', 'All fields are required');
      return;
    }
    try {
      setSaving(true);
      // Send onboard as string (YYYY-MM-DD)
      const payload = {
        username: createForm.username,
        password: createForm.password,
        routeName: createForm.routeName,
        access: createForm.access,
        onboard: createForm.onboard // string from input
      };
      const res = await fetch(`${API_URL}/api/logins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok && result.ok) {
        setLogins([result.data, ...logins]);
        setCreateForm({ username: '', password: '', routeName: 'All', onboard: '', access: 'enable' });
        setShowCreateForm(false);
        showMessage('success', 'User created successfully!');
      } else {
        showMessage('error', result.message || 'Failed to create user');
      }
    } catch (err) {
      console.error('Error creating user:', err);
      showMessage('error', 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this login?')) return;

    try {
      const res = await fetch(`${API_URL}/api/logins/${id}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      if (res.ok && result.ok) {
        setLogins(logins.filter(login => login._id !== id));
        showMessage('success', 'Login deleted successfully!');
      } else {
        showMessage('error', result.message || 'Failed to delete login');
      }
    } catch (err) {
      console.error('Error deleting login:', err);
      showMessage('error', 'Failed to delete login');
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };



  // Filter out "All" routeName for stats and grid
  const filteredLogins = logins.filter(
    login => String(login.routeName).toLowerCase() !== 'all'
  );
  const activeRoutesCount = filteredLogins.filter(
    login => login.access === 'enable'
  ).length;

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading login data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div className="header-content">
          <h1>Login Analytics & Management</h1>
          <p className="subtitle">View and manage all login credentials</p>
        </div>
        <div className="header-actions">
          <button className="create-user-btn" onClick={() => setShowCreateForm(!showCreateForm)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            Add User
          </button>
          <button className="back-button" onClick={() => navigate('/dashboard')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' ? '✓ ' : '⚠ '}
          {message.text}
        </div>
      )}

      {showCreateForm && (
        <div className="create-form-container">
          <form onSubmit={handleCreateUser} className="create-form">
            <h3>Create New User</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="Enter username"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Enter password"
                  required
                />
              </div>
              <div className="form-group">
                <label>Route Name</label>
                <select
                  value={createForm.routeName}
                  onChange={(e) => setCreateForm({ ...createForm, routeName: e.target.value })}
                  required
                >
                  {availableRoutes.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Onboard Date</label>
                <input
                  type="date"
                  value={createForm.onboard}
                  onChange={(e) => setCreateForm({ ...createForm, onboard: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Access</label>
                <select
                  value={createForm.access}
                  onChange={(e) => setCreateForm({ ...createForm, access: e.target.value })}
                >
                  <option value="enable">Enable</option>
                  <option value="disable">Disable</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-save" disabled={saving}>
                {saving ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="analytics-stats">
        <div className="stat-card">
          <div className="stat-icon total">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <div className="stat-info">
            <h3>Total Logins</h3>
            <p className="stat-number">{filteredLogins.length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 11.75c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25-.56-1.25-1.25-1.25zm6 0c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25-.56-1.25-1.25-1.25zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-.29.02-.58.05-.86 2.36-1.05 4.23-2.98 5.21-5.37C11.07 8.33 14.05 10 17.42 10c.78 0 1.53-.09 2.25-.26.21.71.33 1.47.33 2.26 0 4.41-3.59 8-8 8z"/>
            </svg>
          </div>
          <div className="stat-info">
            <h3>Active Routes</h3>
            <p className="stat-number">{activeRoutesCount}</p>
          </div>
        </div>
      </div>

      {filteredLogins.length === 0 ? (
        <div className="no-data">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h2>No Login Records Found</h2>
          <p>There are no login credentials in the database.</p>
        </div>
      ) : (
        <div className="logins-grid">
          {filteredLogins.map((login, index) => (
              <div key={login._id} className={`login-card ${editingId === login._id ? 'editing' : ''}`}>
                <div className="card-header">
                  <div className="card-number">#{index + 1}</div>
                  <div className="card-badges">
                    {login.routeName.toLowerCase() === 'all' ? (
                      <span className="badge active">Active Editor</span>
                    ) : (
                      <span className="badge inactive">Limited Access</span>
                    )}
                    <span className={`badge ${login.access === 'enable' ? 'enabled' : 'disabled'}`}>
                      {login.access === 'enable' ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="card-body">
                  {editingId === login._id ? (
                    <>
                      <div className="form-group">
                        <label htmlFor={`username-${login._id}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                          </svg>
                          Username
                        </label>
                        <input
                          type="text"
                          id={`username-${login._id}`}
                          name="username"
                          value={editForm.username}
                          onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                          placeholder="Enter username"
                          className="edit-input"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor={`password-${login._id}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                          </svg>
                          Password
                        </label>
                        <input
                          type="text"
                          id={`password-${login._id}`}
                          name="password"
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                          placeholder="Enter password"
                          className="edit-input"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor={`routeName-${login._id}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                          </svg>
                          Route Name
                        </label>
                        <select
                          id={`routeName-${login._id}`}
                          name="routeName"
                          value={editForm.routeName}
                          onChange={(e) => setEditForm({ ...editForm, routeName: e.target.value })}
                          className="edit-input"
                        >
                          {availableRoutes.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor={`onboard-${login._id}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                          </svg>
                          Onboard Date
                        </label>
                        <input
                          type="date"
                          id={`onboard-${login._id}`}
                          name="onboard"
                          value={editForm.onboard || ''}
                          onChange={(e) => setEditForm({ ...editForm, onboard: e.target.value })}
                          className="edit-input"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`access-${login._id}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          Access
                        </label>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={editForm.access === 'enable'}
                            onChange={() =>
                              setEditForm(prev => ({
                                ...prev,
                                access: prev.access === 'enable' ? 'disable' : 'enable'
                              }))
                            }
                          />
                          <span className="toggle-slider"></span>
                        </label>
                        <span style={{ marginLeft: 8 }}>{editForm.access === 'enable' ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="info-row">
                        <div className="info-label">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                          </svg>
                          Username
                        </div>
                        <div className="info-value">{login.username}</div>
                      </div>

                      <div className="info-row">
                        <div className="info-label">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                          </svg>
                          Password
                        </div>
                        <div className="info-value password">{'•'.repeat(login.password.length)}</div>
                      </div>

                      <div className="info-row">
                        <div className="info-label">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                          </svg>
                          Route Name
                        </div>
                        <div className="info-value">{login.routeName}</div>
                      </div>

                      <div className="info-row">
                        <div className="info-label">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                          </svg>
                          Onboard Date
                        </div>
                        <div className="info-value">{new Date(login.onboard).toLocaleDateString()}</div>
                      </div>

                      <div className="info-row">
                        <div className="info-label">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          Access Control
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={login.access === 'enable'}
                            onChange={() => handleToggleAccess(login._id, login.access)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    </>
                  )}
                </div>

                <div className="card-footer">
                  {editingId === login._id ? (
                    <div className="edit-actions">
                      <button 
                        className="btn-cancel" 
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button 
                        className="btn-save" 
                        onClick={() => handleSave(login._id)}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  ) : (
                    <div className="view-actions">
                      <button 
                        className="btn-edit" 
                        onClick={() => handleEdit(login)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                        Edit
                      </button>
                      <button 
                        className="btn-delete" 
                        onClick={() => handleDelete(login._id)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
