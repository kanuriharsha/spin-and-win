import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './ClientDashboard.css';

const API_URL = ((typeof window !== 'undefined') && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '::1'
))
  ? 'http://localhost:5000'
  : (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) || 'http://localhost:5000';

export default function ClientDashboard() {
  const { authed, role, clientData, logout } = useAuth();
  const navigate = useNavigate();
  const [wheel, setWheel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSegmentIndex, setEditingSegmentIndex] = useState(null);
  const [editedSegment, setEditedSegment] = useState(null);
  const [pendingUpdates, setPendingUpdates] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Redirect if not authenticated as client
  useEffect(() => {
    if (!authed || role !== 'client' || !clientData) {
      navigate('/client-login', { replace: true });
    }
  }, [authed, role, clientData, navigate]);

  // Fetch wheel data
  useEffect(() => {
    if (!clientData) return;
    fetchWheel();
    fetchPendingUpdates();
  }, [clientData]);

  const fetchWheel = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/client/wheel`, {
        headers: {
          'clientid': clientData.clientId,
          'wheelid': clientData.wheelId,
          'routename': clientData.routeName
        }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || 'Failed to load wheel');
        return;
      }
      setWheel(data.wheel);
    } catch (err) {
      setError('Failed to load wheel data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingUpdates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/client/pending-updates`, {
        headers: {
          'clientid': clientData.clientId,
          'wheelid': clientData.wheelId,
          'routename': clientData.routeName
        }
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setPendingUpdates(data.updates || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending updates:', err);
    }
  };

  const handleEditSegment = (index) => {
    const segment = wheel.segments[index];
    setEditingSegmentIndex(index);
    setEditedSegment({
      text: segment.text,
      color: segment.color,
      prizeType: segment.prizeType || 'other',
      amount: segment.amount || '',
      dailyLimit: segment.dailyLimit || ''
    });
    setSuccessMessage('');
  };

  const handleCancelEdit = () => {
    setEditingSegmentIndex(null);
    setEditedSegment(null);
  };

  const handleSubmitChanges = async () => {
    if (editingSegmentIndex === null || !editedSegment) return;

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch(`${API_URL}/api/client/submit-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'clientid': clientData.clientId,
          'wheelid': clientData.wheelId,
          'routename': clientData.routeName
        },
        body: JSON.stringify({
          segmentUpdates: [{
            segmentIndex: editingSegmentIndex,
            updatedData: editedSegment
          }]
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || 'Failed to submit changes');
        return;
      }

      setSuccessMessage('Your changes have been submitted for admin approval!');
      setEditingSegmentIndex(null);
      setEditedSegment(null);
      fetchPendingUpdates();
    } catch (err) {
      setError('Failed to submit changes. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    // AuthContext.logout will clear auth and redirect to /login
    logout();
  };

  if (loading) {
    return (
      <div className="client-dashboard">
        <div className="client-loading">Loading your wheel...</div>
      </div>
    );
  }

  if (!wheel) {
    return (
      <div className="client-dashboard">
        <div className="client-error">Unable to load wheel data</div>
      </div>
    );
  }

  return (
    <div className="client-dashboard">
      {/* Header */}
      <div className="client-header">
        <div className="client-header-content">
          <div className="client-info">
            <h1>{wheel.name}</h1>
            <p className="client-route">Route: <span>/{wheel.routeName}</span></p>
            <p className="client-username">Logged in as: <span>{clientData.username}</span></p>
          </div>
          <button onClick={handleLogout} className="client-logout-btn">
            Logout
          </button>
        </div>
      </div>

      <div className="client-container">
        {/* Messages */}
        {error && <div className="client-message client-error-msg">{error}</div>}
        {successMessage && <div className="client-message client-success-msg">{successMessage}</div>}

        {/* Pending Updates Notice */}
        {pendingUpdates.length > 0 && (
          <div className="pending-updates-notice">
            <h3>📝 Pending Updates</h3>
            <p>You have {pendingUpdates.filter(u => u.status === 'pending').length} update(s) awaiting admin review</p>
            <div className="pending-list">
              {pendingUpdates.slice(0, 3).map((update, idx) => (
                <div key={idx} className={`pending-item status-${update.status}`}>
                  <span className="pending-status">{update.status}</span>
                  <span className="pending-date">
                    {new Date(update.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content: Two Blocks Only */}
        <div className="client-main">
          {/* Block 1: Wheel Segments (View Only) */}
          <div className="client-block">
            <h2>Wheel Segments</h2>
            <div className="segments-grid">
              {wheel.segments.map((segment, index) => (
                <div key={index} className="segment-card">
                  <div className="segment-header">
                    <span className="segment-number">Segment {index + 1}</span>
                    <button 
                      onClick={() => handleEditSegment(index)}
                      className="edit-segment-btn"
                      disabled={editingSegmentIndex !== null}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="segment-preview">
                    <div 
                      className="segment-color-box" 
                      style={{ backgroundColor: segment.color }}
                    ></div>
                    <div className="segment-details">
                      <p className="segment-text">{segment.text}</p>
                      <p className="segment-prize">
                        {segment.prizeType}: {segment.amount || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Block 2: Edit Segment (Only When Editing) */}
          {editingSegmentIndex !== null && editedSegment && (
            <div className="client-block edit-block">
              <h2>Edit Segment {editingSegmentIndex + 1}</h2>
              <div className="edit-form">
                <div className="form-group">
                  <label>Segment Text *</label>
                  <input
                    type="text"
                    value={editedSegment.text}
                    onChange={(e) => setEditedSegment({ ...editedSegment, text: e.target.value })}
                    placeholder="e.g., Win $100"
                    maxLength={50}
                  />
                </div>

                <div className="form-group">
                  <label>Segment Color *</label>
                  <div className="color-input-group">
                    <input
                      type="color"
                      value={editedSegment.color}
                      onChange={(e) => setEditedSegment({ ...editedSegment, color: e.target.value })}
                    />
                    <input
                      type="text"
                      value={editedSegment.color}
                      onChange={(e) => setEditedSegment({ ...editedSegment, color: e.target.value })}
                      placeholder="#000000"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Prize Type</label>
                  <select
                    value={editedSegment.prizeType}
                    onChange={(e) => setEditedSegment({ ...editedSegment, prizeType: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="loyalty">Loyalty Points</option>
                    <option value="percentage">Percentage</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Prize Amount</label>
                  <input
                    type="text"
                    value={editedSegment.amount}
                    onChange={(e) => setEditedSegment({ ...editedSegment, amount: e.target.value })}
                    placeholder="e.g., ₹500 or 30 points"
                  />
                </div>

                <div className="form-group">
                  <label>Daily Limit (optional)</label>
                  <input
                    type="number"
                    value={editedSegment.dailyLimit}
                    onChange={(e) => setEditedSegment({ ...editedSegment, dailyLimit: e.target.value })}
                    placeholder="Leave empty for unlimited"
                    min="0"
                  />
                  <small>Maximum times this segment can be won per day</small>
                </div>

                <div className="form-actions">
                  <button 
                    onClick={handleSubmitChanges} 
                    className="save-btn"
                    disabled={submitting || !editedSegment.text || !editedSegment.color}
                  >
                    {submitting ? 'Submitting...' : 'Submit for Approval'}
                  </button>
                  <button 
                    onClick={handleCancelEdit} 
                    className="cancel-btn"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
