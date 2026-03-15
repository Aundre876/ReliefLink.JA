import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const PUBLIC_PATHS = ['/', '/emergency', '/request-help', '/confirmation'];

/**
 * Checks if the current path is a public (emergency bypass) path.
 */
export function isPublicPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return PUBLIC_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`));
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
  /** If true, user is a guest (has guest_id but no email/password login) */
  isGuest?: boolean;
}

/**
 * Protects /logistics, /dashboard, /admin routes.
 * Redirects unauthenticated users (including guests) to /login.
 */
export default function ProtectedRoute({ children, isAuthenticated, isGuest }: ProtectedRouteProps) {
  const location = useLocation();

  if (isPublicPath(location.pathname)) {
    return <>{children}</>;
  }

  if (!isAuthenticated || isGuest) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
