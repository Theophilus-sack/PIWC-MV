import React from "react";
import { Icon } from "../components/Icon.jsx";
import { useAuth } from "../lib/auth.jsx";

// Phase 1 shell only — layout/structure ported from screens.jsx's Dashboard,
// but stat cards are empty-state placeholders rather than fake generated
// numbers. Real queries (members count, last service attendance, etc.)
// land in Phase 2 once the members/attendance tables exist.
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
          <p>Your workspace stats will appear here once data is connected.</p>
        </div>
      </div>
      <EmptyStatGrid />
    </div>
  );
}

function PastorDashboard({ firstName }) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Pastor's overview</div>
          <h1>Akwaaba, Pastor {firstName}.</h1>
          <p>Reports routed to you and your Word Prep space.</p>
        </div>
      </div>
      <EmptyStatGrid />
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div className="glass card">
          <div className="eyebrow">Routed to you</div>
          <h3 style={{ fontSize: 18, marginTop: 4, marginBottom: 10 }}>Reports awaiting review</h3>
          <p className="muted" style={{ fontSize: 13.5 }}>Nothing routed yet — this fills in as Reports (Phase 6) comes online.</p>
        </div>
        <div className="glass card">
          <div className="eyebrow">Word Prep</div>
          <h3 style={{ fontSize: 18, marginTop: 4, marginBottom: 10 }}>Sermon notes</h3>
          <p className="muted" style={{ fontSize: 13.5 }}>Your exclusive space — no one else, including Super Admin, can see this. Coming in Phase 5.</p>
        </div>
      </div>
    </div>
  );
}

function EmptyStatGrid() {
  const cards = [
    { label: "Total members", icon: "members" },
    { label: "Last service attendance", icon: "attendance" },
    { label: "This month's giving", icon: "reports" },
    { label: "New members", icon: "sparkle" },
  ];
  return (
    <div className="grid cols-4">
      {cards.map((c) => (
        <div className="glass stat-card" key={c.label}>
          <div className="label">{c.label}</div>
          <div className="value" style={{ color: "var(--ink-4)" }}>—</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name={c.icon} size={13} /> Connect data source
          </div>
        </div>
      ))}
    </div>
  );
}
