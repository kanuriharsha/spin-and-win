import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './PendingUpdates.css';

const API_URL = ((typeof window !== 'undefined') && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '::1'
))
  ? 'http://localhost:5000'
  : (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) || 'http://localhost:5000';

export default function PendingUpdates() {
  const [pendingUpdates, setPendingUpdates] = useState([]);
  const [allUpdates, setAllUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [routeFilter, setRouteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortDir, setSortDir] = useState('desc');
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingUpdates();
    fetchAllUpdates();
  }, [routeFilter, statusFilter, sortBy, sortDir]);

  const fetchPendingUpdates = async () => {
    try {
      const params = new URLSearchParams();
      if (routeFilter) params.append('routeName', routeFilter);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortDir) params.append('sortDir', sortDir);
      const res = await fetch(`${API_URL}/api/admin/pending-updates?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setPendingUpdates(data.updates || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending updates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUpdates = async () => {
    try {
      const params = new URLSearchParams();
      if (routeFilter) params.append('routeName', routeFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortDir) params.append('sortDir', sortDir);
      params.append('limit', '100');
      const res = await fetch(`${API_URL}/api/admin/all-updates?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setAllUpdates(data.updates || []);
      }
    } catch (err) {
      console.error('Failed to fetch all updates:', err);
    }
  };

  const handleApprove = async (updateId) => {
    // Approval handled on the detail page; list view does not perform approve actions.
  };

  const handleDelete = async (updateId) => {
    setProcessing(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_URL}/api/admin/update/${updateId}`, {
        method: 'DELETE'
      });

      const data = await res.json().catch(() => ({}));
      // Treat 200/404 as success for UI cleanliness
      if (res.ok || res.status === 404 || data.ok === true) {
        setPendingUpdates((prev) => prev.filter(u => u._id !== updateId));
        setAllUpdates((prev) => prev.filter(u => u._id !== updateId));
        setMessage({ type: 'success', text: 'Update deleted' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to delete update' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete update' });
    } finally {
      setProcessing(false);
    }
  };

  // Legacy modal/preview code removed — details are now shown on the dedicated detail page

  // Rejection handled on the detail page; list view does not perform reject actions.

  // Detailed review UI moved to `PendingUpdateDetail.jsx` route; list page only links to it.

  if (loading) {
    return <div className="pending-updates-page"><div className="loading">Loading updates...</div></div>;
  }

  const displayUpdates = activeTab === 'pending' ? pendingUpdates : allUpdates;
  const disableDelete = processing;

  return (
    <div className="pending-updates-page">
      <div className="page-header">
        <h1>Client Update Requests</h1>
        <p>Review and approve client-submitted wheel segment changes</p>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="filters-row">
        <div className="filter-group">
          <label>Route</label>
          <input
            type="text"
            placeholder="e.g. super"
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value.trim())}
          />
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Sort</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="submittedAt">Date submitted</option>
            <option value="routeName">Route name</option>
            <option value="client">Client</option>
            <option value="status">Status</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Order</label>
          <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({pendingUpdates.length})
        </button>
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Updates ({allUpdates.length})
        </button>
      </div>

      {displayUpdates.length === 0 ? (
        <div className="empty-state">
          <p>No updates to display</p>
        </div>
      ) : (
        <div className="updates-list">
          {displayUpdates.map((update) => (
            <div key={update._id} className="update-card">
              <div className="update-header">
                <div>
                  <h3>{update.wheelId?.name || 'Unknown Wheel'}</h3>
                  <p className="route-name">/{update.routeName}</p>
                </div>
                <span className={`status-badge status-${update.status}`}>
                  {update.status}
                </span>
              </div>

              <div className="update-meta">
                <span>👤 {update.clientUsername}</span>
                <span>📅 {new Date(update.submittedAt).toLocaleDateString()}</span>
                <span>🎯 {update.segmentUpdates.length} segment(s)</span>
              </div>

              <div className="card-actions">
                <button
                  onClick={() => navigate(`/pending-updates/${update._id}`)}
                  className="review-btn"
                >
                  View Details
                </button>
                <button
                  onClick={() => handleDelete(update._id)}
                  className="delete-btn"
                  disabled={disableDelete}
                >
                  {disableDelete ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
