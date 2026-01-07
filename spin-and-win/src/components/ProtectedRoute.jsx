import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { authed, role, clientData } = useAuth();
  const location = useLocation();

  // Allow admin users full access
  if (authed && role === 'admin') return <Outlet />;

  // If client, allow access only to their assigned editor route: /editor/:id
  if (authed && role === 'client' && clientData && clientData.wheelId) {
    const path = location.pathname || '';
    const match = path.match(/^\/editor\/(?<id>[a-fA-F0-9]{24})$/);
    if (match && match.groups && match.groups.id === clientData.wheelId) {
      return <Outlet />;
    }
  }

  // Otherwise redirect to login
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
