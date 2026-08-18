import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { useAuth } from "../lib/auth.jsx";
import { accessLevel } from "../lib/rbac.js";
import { formatGHS } from "../lib/finance.js";
import { useMemberStats } from "../hooks/useMembers.js";
import { useLastServiceAttendance } from "../hooks/useAttendance.js";
import { useCurrentMonthGiving } from "../hooks/useFinance.js";

// Members/Attendance stats (Phase 2) and Finance (Phase 3) are both real
// now.
//
// The Pastor's dashboard is intentionally a distinct branch, not a
// relabeled default — per spec it surfaces reports routed to him and a
// Sermon Prep shortcut, not just generic stats.
export function Dashboard() {
  const { profile, role } = useAuth();
  const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";

  if (role === "pastor") {
    return <PastorDashboard firstName={firstName} />;
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Overview</div>
          <h1>Akwaaba, {firstName}.</h1>
          <p>Here's a quick look at the family this week.</p>
        </div>
      </div>
      <StatGrid />
    </div>
  );
}

function PastorDashboard({ firstName }) {
  const navigate = useNavigate();
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Pastor's overview</div>
          <h1>Akwaaba, Pastor {firstName}.</h1>
          <p>Reports routed to you and your Word Prep space.</p>
        </div>
      </div>
      <StatGrid />
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div className="glass card" style={{ cursor: "pointer" }} onClick={() => navigate("/reports")}>
          <div className="eyebrow">Routed to you</div>
          <h3 style={{ fontSize: 18, marginTop: 4, marginBottom: 10 }}>Reports</h3>
          <p className="muted" style={{ fontSize: 13.5 }}>Members, attendance, finance, and messaging — summarized in one place.</p>
        </div>
        <div className="glass card" style={{ cursor: "pointer" }} onClick={() => navigate("/sermon-prep")}>
          <div className="eyebrow">Word Prep</div>
          <h3 style={{ fontSize: 18, marginTop: 4, marginBottom: 10 }}>Sermon notes</h3>
          <p className="muted" style={{ fontSize: 13.5 }}>Your exclusive space — no one else, including Super Admin, can see this.</p>
        </div>
      </div>
    </div>
  );
}

function StatGrid() {
  const { role } = useAuth();
  const hasFinanceAccess = Boolean(accessLevel(role, "finance"));
  const { data: memberStats, isLoading: membersLoading } = useMemberStats();
  const { data: lastService, isLoading: attendanceLoading } = useLastServiceAttendance();
  const { data: giving, isLoading: givingLoading } = useCurrentMonthGiving();

  return (
    <div className="grid cols-4">
      <div className="glass stat-card">
        <div className="deco" style={{ background: "var(--blue-500)" }} />
        <div className="label">Total members</div>
        <div className="value">{membersLoading ? "—" : memberStats?.total ?? 0}</div>
        <div className="delta up"><Icon name="arrowUp" size={12} /> +{membersLoading ? "…" : memberStats?.newThisMonth ?? 0} this month</div>
      </div>

      <div className="glass stat-card">
        <div className="deco" style={{ background: "var(--gold-500)" }} />
        <div className="label">Last service attendance</div>
        <div className="value">{attendanceLoading ? "—" : lastService?.count ?? "—"}</div>
        <div className={"delta " + (lastService?.delta >= 0 ? "up" : "down")}>
          {lastService ? (
            <>
              <Icon name={lastService.delta >= 0 ? "arrowUp" : "arrowDown"} size={12} />
              {lastService.delta == null ? "First recorded service" : `${lastService.delta >= 0 ? "+" : ""}${lastService.delta} vs prev.`}
            </>
          ) : (
            <span className="muted">No service logged yet</span>
          )}
        </div>
      </div>

      <div className="glass stat-card">
        <div className="deco" style={{ background: "var(--blue-700)" }} />
        <div className="label">This month's giving</div>
        {hasFinanceAccess ? (
          <>
            <div className="value" style={{ fontSize: 28 }}>{givingLoading ? "—" : formatGHS(giving?.total)}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="reports" size={13} /> {giving?.hasData ? "Tithes + missions offering" : "No figures entered yet"}
            </div>
          </>
        ) : (
          <>
            <div className="value" style={{ color: "var(--ink-4)" }}>—</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="lock" size={13} /> Restricted to Finance
            </div>
          </>
        )}
      </div>

      <div className="glass stat-card">
        <div className="deco" style={{ background: "var(--gold-400)" }} />
        <div className="label">New members</div>
        <div className="value">{membersLoading ? "—" : memberStats?.newThisMonth ?? 0}</div>
        <div className="delta up"><Icon name="sparkle" size={12} /> Welcomed this month</div>
      </div>
    </div>
  );
}
