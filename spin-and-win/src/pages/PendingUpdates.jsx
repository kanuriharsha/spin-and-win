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
    setProcessing(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_URL}/api/admin/approve-update/${updateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewedBy: 'Admin',
          reviewNotes: reviewNotes
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to approve update' });
        return;
      }

      setMessage({ type: 'success', text: `Update approved for wheel: ${data.routeName}` });
      fetchPendingUpdates();
      fetchAllUpdates();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to approve update' });
    } finally {
      setProcessing(false);
    }
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

  const handleReject = async (updateId) => {
    setProcessing(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_URL}/api/admin/reject-update/${updateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewedBy: 'Admin',
          reviewNotes: reviewNotes || 'Rejected by admin'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to reject update' });
        return;
      }

      setMessage({ type: 'success', text: 'Update rejected successfully' });
      setSelectedUpdate(null);
      setReviewNotes('');
      fetchPendingUpdates();
      fetchAllUpdates();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to reject update' });
    } finally {
      setProcessing(false);
    }
  };

  const renderUpdateDetails = (update) => {
    if (!update) return null;

    return (
      <div className="update-details-modal">
        <div className="modal-overlay" onClick={() => setSelectedUpdate(null)}></div>
        <div className="modal-content">
          <div className="modal-header">
            <h2>Review Update</h2>
            <button className="close-btn" onClick={() => setSelectedUpdate(null)}>×</button>
          </div>

          <div className="modal-body">
            <div className="update-info">
              <p><strong>Client:</strong> {update.clientUsername}</p>
              <p><strong>Wheel:</strong> {update.wheelId?.name || 'N/A'}</p>
              <p><strong>Route:</strong> /{update.routeName}</p>
              <p><strong>Submitted:</strong> {new Date(update.submittedAt).toLocaleString()}</p>
              <p><strong>Status:</strong> <span className={`status-badge status-${update.status}`}>{update.status}</span></p>
            </div>

            <div className="segment-changes">
              <h3>Segment Changes</h3>
              {update.segmentUpdates.map((segUpdate, idx) => {
                const prev = segUpdate.previousData || {};
                const next = segUpdate.updatedData || {};
                const prevColor = prev.color || '#ccc';
                const nextColor = next.color || '#ccc';
                return (
                  <div key={idx} className="change-item">
                    <h4>Segment {segUpdate.segmentIndex + 1}</h4>
                    <div className="change-comparison">
                      <div className="change-column">
                        <h5>Previous</h5>
                        <div className="segment-preview">
                          <div className="color-box" style={{ backgroundColor: prevColor }}></div>
                          <div>
                            <p><strong>Text:</strong> {prev.text || '—'}</p>
                            <p><strong>Prize:</strong> {prev.prizeType || '—'} - {prev.amount || '—'}</p>
                            <p><strong>Daily Limit:</strong> {prev.dailyLimit || 'Unlimited'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="arrow">→</div>
                      <div className="change-column">
                        <h5>New</h5>
                        <div className="segment-preview">
                          <div className="color-box" style={{ backgroundColor: nextColor }}></div>
                          <div>
                            <p><strong>Text:</strong> {next.text || '—'}</p>
                            <p><strong>Prize:</strong> {next.prizeType || '—'} - {next.amount || '—'}</p>
                            <p><strong>Daily Limit:</strong> {next.dailyLimit || 'Unlimited'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="wheel-previews">
              <h3>Wheel Preview</h3>
              {previewLoading && <p className="preview-loading">Loading wheel preview...</p>}
              {!previewLoading && wheelBefore && wheelAfter && (
                <div className="wheel-preview-row">
                  <div className="wheel-preview-col">
                    <h4>Current Wheel</h4>
                    <WheelPreview wheelData={wheelBefore} />
                  </div>
                  <div className="wheel-preview-col">
                    <h4>After Update</h4>
                    <WheelPreview wheelData={wheelAfter} />
                  </div>
                </div>
              )}
              {!previewLoading && (!wheelBefore || !wheelAfter) && (
                <p className="preview-loading">Wheel preview not available.</p>
              )}
            </div>

            {update.status === 'pending' && (
              <>
                <div className="review-notes">
                  <label>Review Notes (optional)</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about this review..."
                    rows="3"
                  />
                </div>

                <div className="modal-actions">
                  <button
                    onClick={() => handleApprove(update._id)}
                    className="approve-btn"
                    disabled={processing}
                  >
                    {processing ? 'Processing...' : 'Approve & Apply'}
                  </button>
                  <button
                    onClick={() => handleReject(update._id)}
                    className="reject-btn"
                    disabled={processing}
                  >
                    {processing ? 'Processing...' : 'Reject'}
                  </button>
                  <button
                    onClick={() => handleDelete(update._id)}
                    className="delete-btn"
                    disabled={processing}
                  >
                    {processing ? 'Processing...' : 'Delete'}
                  </button>
                </div>
              </>
            )}

            {update.status !== 'pending' && update.reviewNotes && (
              <div className="review-info">
                <h4>Review Details</h4>
                <p><strong>Reviewed By:</strong> {update.reviewedBy}</p>
                <p><strong>Reviewed At:</strong> {new Date(update.reviewedAt).toLocaleString()}</p>
                <p><strong>Notes:</strong> {update.reviewNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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
