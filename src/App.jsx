import React from "react";
import { Routes, Route } from "react-router-dom";
import { AppShell } from "./layout/AppShell.jsx";
import { ProtectedRoute } from "./lib/ProtectedRoute.jsx";
import { Login } from "./pages/Login.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { SettingsPage } from "./pages/Settings.jsx";
import { ComingSoon } from "./pages/ComingSoon.jsx";

// One entry per NAV_ITEMS module (src/lib/rbac.js) — module key must match
// so nav visibility and route guarding stay in sync. Each ComingSoon()
// gets replaced by its real page as later phases build it.
const MODULE_ROUTES = [
  { path: "/members", module: "members", title: "Members", phase: "Phase 2" },
  { path: "/attendance", module: "attendance", title: "Attendance", phase: "Phase 2" },
  { path: "/pastoral-care", module: "pastoral_care", title: "Pastoral Care", phase: "Phase 6" },
  { path: "/finance", module: "finance", title: "Finance", phase: "Phase 3" },
  { path: "/messages", module: "messages", title: "Messages", phase: "Phase 4" },
  { path: "/events", module: "events", title: "Events", phase: "Phase 6" },
  { path: "/groups", module: "groups", title: "Groups/Ministries", phase: "Phase 2" },
  { path: "/leadership", module: "leadership", title: "Leadership", phase: "Phase 2" },
  { path: "/inventory", module: "inventory", title: "Inventory", phase: "Phase 6" },
  { path: "/reports", module: "reports", title: "Reports", phase: "Phase 6" },
  { path: "/sermon-prep", module: "sermon_prep", title: "Sermon/Word Prep", phase: "Phase 5" },
  { path: "/audit-logs", module: "audit_logs", title: "Audit Logs", phase: "Phase 5" },
  { path: "/admin", module: "admin", title: "Admin", phase: "Phase 5" },
];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        {MODULE_ROUTES.map(({ path, module, title, phase }) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute module={module}>
                <ComingSoon title={title} phase={phase} />
              </ProtectedRoute>
            }
          />
        ))}
      </Route>
    </Routes>
  );
}
