import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Dashboard.css';

// ✅ Prefer localhost:5000, else REACT_APP_API_URL, else localhost:5000
const API_URL =
  ((typeof window !== 'undefined') &&
   (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1'))
    ? 'http://localhost:5000'
    : (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) || 'http://localhost:5000';

export default function Dashboard() {
  const [wheels, setWheels] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const hydratedRef = useRef(new Set());

  useEffect(() => {
    // Fetch saved wheels from the backend
    fetch(`${API_URL}/api/wheels`)
      .then(res => res.json())
      .then(data => {
        setWheels(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching wheels:', err);
        setLoading(false);
      });
  }, []);

  // Hydrate centerImage for cards that don't have it
  useEffect(() => {
    const toLoad = wheels.filter(w => w?._id && !w.centerImage && !hydratedRef.current.has(w._id));
    if (!toLoad.length) return;

    (async () => {
      await Promise.all(
        toLoad.map(async (w) => {
          try {
            const res = await fetch(`${API_URL}/api/wheels/${w._id}`);
            if (!res.ok) return;
            const full = await res.json();
            hydratedRef.current.add(w._id);
            setWheels(prev =>
              prev.map(x =>
                x._id === w._id
                  ? { ...x, centerImage: full.centerImage, centerImageRadius: full.centerImageRadius }
                  : x
              )
            );
          } catch (e) {
            console.warn('Hydrate wheel failed:', w._id, e);
          }
        })
      );
    })();
  }, [wheels]);

  const createNewWheel = () => {
    navigate('/editor');
  };

  const deleteWheel = (id, e) => {
    e.preventDefault();
    e.stopPropagation();

    const wheel = wheels.find(w => w._id === id);
    const routeDisplay = wheel ? `/${wheel.routeName}` : '';
    const nameDisplay = wheel ? `"${wheel.name}" ` : '';

    if (!window.confirm(`Are you sure you want to delete this wheel ${nameDisplay}${routeDisplay}?\n\nAll spin results for route "${wheel?.routeName}" will be deleted as well.`)) return;

    fetch(`${API_URL}/api/wheels/${id}`, {
      method: 'DELETE',
    })
      .then(res => res.json())
      .then(() => {
        setWheels(wheels.filter(wheel => wheel._id !== id));
      })
      .catch(err => console.error('Error deleting wheel:', err));
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Spin & Win Dashboard</h1>
        <div className="header-actions">
          {/* <button className="analytics-btn" onClick={() => navigate('/analytics')}>
            📊 Analytics
          </button> */}
          <button className="create-btn" onClick={createNewWheel}>
            Create New Wheel
          </button>
        </div>
      </header>

      <div className="wheels-grid">
        {loading ? (
          <div className="loading">Loading your wheels...</div>
        ) : wheels.length === 0 ? (
          <div className="no-wheels">
            <h2>No wheels found</h2>
            <p>Create your first spinning wheel by clicking the button above</p>
          </div>
        ) : (
          wheels.map(wheel => (
            <div className="wheel-card" key={wheel._id}>
              <Link to={`/editor/${wheel._id}`} className="wheel-link">
                <div
                  className="wheel-preview"
                  style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#f3f4f6' }}
                >
                  {wheel.centerImage ? (
                    <div
                      className="wheel-cover"
                      role="img"
                      aria-label={`${wheel.name} theme`}
                      style={{
                        width: '100%',
                        paddingTop: '52%' ,// ~16:9 cover
                        backgroundImage: `url(${wheel.centerImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    />
                  ) : (
                    <div
                      className="wheel-thumbnail-placeholder"
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        height: 160,
                        background: '#f1f5f9',
                        color: '#1f2937',
                        fontWeight: 700,
                        borderRadius: 12
                      }}
                    >
                      {wheel.name?.trim()?.charAt(0) || 'W'}
                    </div>
                  )}
                </div>
                <div className="wheel-info">
                  <h3>{wheel.name}</h3>
                  <p className="wheel-route">/{wheel.routeName}</p>
                </div>
              </Link>
              <div className="wheel-actions">
                <a
                  href={`/${wheel.routeName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-btn"
                >
                  View
                </a>
                <button
                  className="delete-btn"
                  onClick={(e) => deleteWheel(wheel._id, e)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

