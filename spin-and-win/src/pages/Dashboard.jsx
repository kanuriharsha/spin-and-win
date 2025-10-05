import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Dashboard.css';

// ✅ API base from env (fallback to local)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Dashboard() {
  const [wheels, setWheels] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const createNewWheel = () => {
    navigate('/editor');
  };

  const deleteWheel = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this wheel?')) return;
    
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
        <button className="create-btn" onClick={createNewWheel}>
          Create New Wheel
        </button>
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
                <div className="wheel-preview">
                  {wheel.centerImage ? (
                    <img 
                      src={wheel.centerImage} 
                      alt="Wheel center" 
                      className="wheel-thumbnail"
                    />
                  ) : (
                    <div className="wheel-thumbnail-placeholder">
                      {wheel.name.charAt(0)}
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
