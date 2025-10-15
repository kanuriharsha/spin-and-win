import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  
  // Don't show navbar on custom wheel pages (routes with just one segment after the slash)
  const pathParts = location.pathname.split('/').filter(Boolean);
<<<<<<< HEAD
  if (pathParts.length === 1 && !['dashboard', 'editor', 'analytics'].includes(pathParts[0])) {
=======
  if (pathParts.length === 1 && !['dashboard', 'editor'].includes(pathParts[0])) {
>>>>>>> d79af09766903dbd7cb087598c8d3aafd690b1c1
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-logo">
          Spin &amp; Win
        </Link>
        
        <div className="nav-menu">
          <Link 
            to="/dashboard" 
            className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
          >
            Dashboard
          </Link>
          <Link 
            to="/editor" 
            className={`nav-link ${location.pathname.includes('/editor') ? 'active' : ''}`}
          >
            Create New Wheel
          </Link>
<<<<<<< HEAD
          <Link 
            to="/analytics" 
            className={`nav-link ${location.pathname === '/analytics' ? 'active' : ''}`}
          >
            Analytics
=======
          <Link
            to="/analytics-login"
            className={`nav-link ${location.pathname === '/analytics-login' ? 'active' : ''}`}
          >
            Analytics Login
>>>>>>> d79af09766903dbd7cb087598c8d3aafd690b1c1
          </Link>
        </div>
      </div>
    </nav>
  );
}
<<<<<<< HEAD
//           </Link>
//         </div>
//       </div>
//     </nav>
//   );
// }
=======
>>>>>>> d79af09766903dbd7cb087598c8d3aafd690b1c1
