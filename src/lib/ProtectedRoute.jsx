import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { can } from "./rbac.js";

/**
 * Gates a route behind authentication and, optionally, a module permission.
 * This is UI convenience only (avoids flashing a page a role can't use) —
 * the real enforcement is server-side RLS. A user who bypasses this (e.g.
 * by hitting the API directly) still gets rejected at the database.
 */
export function ProtectedRoute({ module, children }) {
  const { isAuthenticated, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="content" style={{ padding: 40 }}>Loading…</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (module && !can(role, module)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
