import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ClientRoute() {
  const { authed, role } = useAuth();
  const location = useLocation();

  if (!authed || role !== 'client') {
    return <Navigate to="/client-login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
