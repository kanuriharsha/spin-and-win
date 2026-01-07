import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import WheelPreview from '../components/WheelPreview';
import './PendingUpdates.css';

const API_URL = ((typeof window !== 'undefined') && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '::1'
))
  ? 'http://localhost:5000'
  : (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) || 'http://localhost:5000';

export default function PendingUpdateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [update, setUpdate] = useState(null);
  const [wheelBefore, setWheelBefore] = useState(null);
  const [wheelAfter, setWheelAfter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadUpdate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/update/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMessage({ type: 'error', text: data.message || 'Update not found' });
        return;
      }
      const upd = data.update;
      setUpdate(upd);
      const wheel = upd.wheelId || {};
      if (wheel?.segments) {
        setWheelBefore(wheel);
        setWheelAfter(applyUpdatesToWheel(wheel, upd));
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load update' });
    } finally {
      setLoading(false);
    }
  };

  const applyUpdatesToWheel = (wheel, upd) => {
    const clone = JSON.parse(JSON.stringify(wheel || {}));
    const segs = Array.isArray(clone.segments) ? [...clone.segments] : [];
    (upd?.segmentUpdates || []).forEach((segUpdate) => {
      const idx = segUpdate.segmentIndex;
      const next = segUpdate.updatedData || {};
      if (Number.isInteger(idx) && idx >= 0 && idx < segs.length) {
        segs[idx] = {
          ...segs[idx],
          text: next.text ?? segs[idx].text,
          color: next.color ?? segs[idx].color ?? '#999',
          image: next.image !== undefined ? next.image : segs[idx].image,
          prizeType: next.prizeType ?? segs[idx].prizeType,
          amount: next.amount !== undefined ? next.amount : segs[idx].amount,
          dailyLimit: next.dailyLimit !== undefined ? next.dailyLimit : segs[idx].dailyLimit,
          rules: next.rules !== undefined ? next.rules : (segs[idx].rules || [])
        };
        return;
      }
      if (Number.isInteger(idx) && idx === segs.length) {
        segs.push({
          text: next.text || `Prize ${idx + 1}`,
          color: next.color || '#999',
          image: next.image || null,
          prizeType: next.prizeType || 'other',
          amount: next.amount || '',
          dailyLimit: next.dailyLimit ?? null,
          rules: next.rules || []
        });
      }
    });
    const nextWheel = { ...clone, segments: segs };
    if (upd?.meta) {
      nextWheel.name = upd.meta.name || nextWheel.name;
      nextWheel.routeName = upd.meta.routeName || nextWheel.routeName;
      nextWheel.spinDurationSec = upd.meta.spinDurationSec || nextWheel.spinDurationSec;
      nextWheel.spinBaseTurns = upd.meta.spinBaseTurns || nextWheel.spinBaseTurns;
      nextWheel.sessionExpiryMinutes = upd.meta.sessionExpiryMinutes || nextWheel.sessionExpiryMinutes;
    }
    return nextWheel;
  };

  const handleApprove = async () => {
    if (!update) return;
    setProcessing(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_URL}/api/admin/approve-update/${update._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedBy: 'Admin' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to approve update' });
        return;
      }
      setMessage({ type: 'success', text: 'Update approved and applied to wheel.' });
      navigate('/pending-updates');
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to approve update' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!update) return;
    setProcessing(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_URL}/api/admin/reject-update/${update._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedBy: 'Admin' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to reject update' });
        return;
      }
      setMessage({ type: 'success', text: 'Update rejected.' });
      navigate('/pending-updates');
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to reject update' });
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!update) return;
    setProcessing(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_URL}/api/admin/update/${update._id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to delete update' });
        return;
      }
      setMessage({ type: 'success', text: 'Update deleted.' });
      navigate('/pending-updates');
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete update' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="pending-updates-page"><div className="loading">Loading...</div></div>;
  }

  if (!update) {
    return (
      <div className="pending-updates-page">
        <p className="message error">Update not found.</p>
        <Link to="/pending-updates" className="review-btn" style={{ display: 'inline-block', width: 'auto' }}>Back</Link>
      </div>
    );
  }

  return (
    <div className="pending-updates-page">
      <div className="page-header" style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1>Review Update</h1>
          <p>Client-submitted changes for /{update.routeName}</p>
        </div>
        <Link to="/pending-updates" className="review-btn" style={{ width: 'auto' }}>Back to list</Link>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="update-info-card">
        <p><strong>Client:</strong> {update.clientUsername}</p>
        <p><strong>Wheel:</strong> {update.wheelId?.name || 'N/A'}</p>
        <p><strong>Route:</strong> /{update.routeName}</p>
        <p><strong>Submitted:</strong> {new Date(update.submittedAt).toLocaleString()}</p>
        <p><strong>Status:</strong> <span className={`status-badge status-${update.status}`}>{update.status}</span></p>
      </div>

      <div className="segment-changes">
        <h3>Segment Changes</h3>
        {(update.segmentUpdates || []).map((segUpdate, idx) => {
          const prev = segUpdate.previousData || {};
          const next = segUpdate.updatedData || {};
          return (
            <div key={idx} className="change-item">
              <h4>Segment {segUpdate.segmentIndex + 1}</h4>
              <div className="change-comparison">
                <div className="change-column">
                  <h5>Previous</h5>
                  <div className="segment-preview">
                    <div className="color-box" style={{ backgroundColor: prev.color || '#ccc' }}></div>
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
                    <div className="color-box" style={{ backgroundColor: next.color || '#ccc' }}></div>
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
        {wheelBefore && wheelAfter ? (
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
        ) : (
          <p className="preview-loading">Wheel preview not available.</p>
        )}
      </div>

      <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
        <button className="approve-btn" onClick={handleApprove} disabled={processing}>
          {processing ? 'Processing...' : 'Approve & Apply'}
        </button>
        <button className="reject-btn" onClick={handleReject} disabled={processing}>
          {processing ? 'Processing...' : 'Reject'}
        </button>
        <button className="delete-btn" onClick={handleDelete} disabled={processing}>
          {processing ? 'Processing...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
