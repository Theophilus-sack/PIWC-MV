import React from "react";
import { Routes, Route } from "react-router-dom";
import { AppShell } from "./layout/AppShell.jsx";
import { ProtectedRoute } from "./lib/ProtectedRoute.jsx";
import { Login } from "./pages/Login.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { SettingsPage } from "./pages/Settings.jsx";
import { ComingSoon } from "./pages/ComingSoon.jsx";
import { MembersList } from "./pages/Members/MembersList.jsx";
import { MemberDetail } from "./pages/Members/MemberDetail.jsx";
import { AttendancePage } from "./pages/Attendance/AttendancePage.jsx";
import { LeadershipPage } from "./pages/Leadership/LeadershipPage.jsx";
import { GroupsPage } from "./pages/Groups/GroupsPage.jsx";
import { FinancePage } from "./pages/Finance/FinancePage.jsx";
import { MessagesPage } from "./pages/Messages/MessagesPage.jsx";
import { SermonPrepPage } from "./pages/SermonPrep/SermonPrepPage.jsx";
import { AuditLogsPage } from "./pages/AuditLogs/AuditLogsPage.jsx";
import { AdminPage } from "./pages/Admin/AdminPage.jsx";

// Modules with a real page built. One entry per NAV_ITEMS module still
// left in MODULE_ROUTES below — module key must match rbac.js so nav
// visibility and route guarding stay in sync.
const MODULE_ROUTES = [
  { path: "/pastoral-care", module: "pastoral_care", title: "Pastoral Care", phase: "Phase 6" },
  { path: "/events", module: "events", title: "Events", phase: "Phase 6" },
  { path: "/inventory", module: "inventory", title: "Inventory", phase: "Phase 6" },
  { path: "/reports", module: "reports", title: "Reports", phase: "Phase 6" },
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

        <Route path="/members" element={<ProtectedRoute module="members"><MembersList /></ProtectedRoute>} />
        <Route path="/members/:id" element={<ProtectedRoute module="members"><MemberDetail /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute module="attendance"><AttendancePage /></ProtectedRoute>} />
        <Route path="/leadership" element={<ProtectedRoute module="leadership"><LeadershipPage /></ProtectedRoute>} />
        <Route path="/groups" element={<ProtectedRoute module="groups"><GroupsPage /></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute module="finance"><FinancePage /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute module="messages"><MessagesPage /></ProtectedRoute>} />
        <Route path="/sermon-prep" element={<ProtectedRoute module="sermon_prep"><SermonPrepPage /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute module="audit_logs"><AuditLogsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute module="admin"><AdminPage /></ProtectedRoute>} />

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
