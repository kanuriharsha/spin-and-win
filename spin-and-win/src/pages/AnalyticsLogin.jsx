import React, { useEffect, useState } from 'react';

const API_URL =
  ((typeof window !== 'undefined') &&
   (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1'))
    ? 'http://localhost:5000'
    : (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) || 'http://localhost:5000';

export default function AnalyticsLogin() {
  const [logins, setLogins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({ username: '', password: '', routeName: '' });
  const [availableRoutes, setAvailableRoutes] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/logins`)
      .then(res => res.json())
      .then(data => {
        setLogins(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/wheels`)
      .then(res => res.json())
      .then(data => {
        const routes = Array.isArray(data) ? data.map(w => String(w.routeName || '')) : [];
        setAvailableRoutes(['All', ...Array.from(new Set(routes)).filter(r => r)]);
      })
      .catch(() => setAvailableRoutes(['All']));
  }, []);

  const handleEdit = (login) => {
    setEditId(login._id);
    setEditData({ username: login.username, password: login.password, routeName: login.routeName });
  };

  const handleUpdate = async () => {
    await fetch(`${API_URL}/api/logins/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData)
    });
    setEditId(null);
    setLoading(true);
    fetch(`${API_URL}/api/logins`)
      .then(res => res.json())
      .then(data => {
        setLogins(data);
        setLoading(false);
      });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this login?')) return;
    await fetch(`${API_URL}/api/logins/${id}`, { method: 'DELETE' });
    setLoading(true);
    fetch(`${API_URL}/api/logins`)
      .then(res => res.json())
      .then(data => {
        setLogins(data);
        setLoading(false);
      });
  };

  return (
    <div className="analytics-login-page">
      <h1>Analytics Login Management</h1>
      {loading ? <div>Loading...</div> : (
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Password</th>
              <th>Route Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {logins.map(login => (
              <tr key={login._id}>
                <td>
                  {editId === login._id ? (
                    <input
                      value={editData.username}
                      onChange={e => setEditData(d => ({ ...d, username: e.target.value }))}
                    />
                  ) : login.username}
                </td>
                <td>
                  {editId === login._id ? (
                    <input
                      value={editData.password}
                      onChange={e => setEditData(d => ({ ...d, password: e.target.value }))}
                    />
                  ) : login.password}
                </td>
                <td>
                  {editId === login._id ? (
                    <select
                      value={editData.routeName}
                      onChange={e => setEditData(d => ({ ...d, routeName: e.target.value }))}
                    >
                      {availableRoutes.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : login.routeName}
                </td>
                <td>
                  {editId === login._id ? (
                    <>
                      <button onClick={handleUpdate}>Save</button>
                      <button onClick={() => setEditId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleEdit(login)}>Edit</button>
                      <button onClick={() => handleDelete(login._id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
