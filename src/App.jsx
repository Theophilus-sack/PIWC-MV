import React from "react";
import { Routes, Route } from "react-router-dom";
import { AppShell } from "./layout/AppShell.jsx";
import { ProtectedRoute } from "./lib/ProtectedRoute.jsx";
import { Login } from "./pages/Login.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { SettingsPage } from "./pages/Settings.jsx";
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
import { PastoralCarePage } from "./pages/PastoralCare/PastoralCarePage.jsx";
import { EventsPage } from "./pages/Events/EventsPage.jsx";
import { InventoryPage } from "./pages/Inventory/InventoryPage.jsx";
import { ReportsPage } from "./pages/Reports/ReportsPage.jsx";

// Every module in rbac.js's NAV_ITEMS now has a real page — Phase 6 was
// the last of the 13.

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
        <Route path="/pastoral-care" element={<ProtectedRoute module="pastoral_care"><PastoralCarePage /></ProtectedRoute>} />
        <Route path="/events" element={<ProtectedRoute module="events"><EventsPage /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute module="inventory"><InventoryPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute module="reports"><ReportsPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}
