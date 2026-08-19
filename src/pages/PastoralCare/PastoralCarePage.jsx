import React from "react";
import { Icon } from "../../components/Icon.jsx";

// Deliberately separate from Support/Ordinance (see rbac.js's
// pastoral_care module/matrix/nav entry) — this is a placeholder that
// reserves the nav slot and route now, per spec, ahead of the real build:
// members organized by location/zone with an assigned Pastoral Care
// leader. No schema/data yet, nothing here to preserve or migrate later.
const PLANNED = [
  { icon: "pin", title: "Locations / Areas", desc: "Group members by where they live or fellowship — zones, districts, or areas." },
  { icon: "user", title: "Pastoral Care Leaders", desc: "Assign a leader responsible for each location/zone." },
  { icon: "members", title: "Assigned Members", desc: "See which members fall under each leader's care." },
  { icon: "heart", title: "Pastoral Care Management", desc: "Track visits, follow-ups, and care activity per zone." },
];

export function PastoralCarePage() {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Pastoral Care</div>
          <h1>Pastoral Care</h1>
          <p>Organizing members by location and assigned care leader — coming soon.</p>
        </div>
      </div>

      <div className="glass card" style={{ padding: 26 }}>
        <p className="muted" style={{ marginBottom: 20, maxWidth: 560 }}>
          This is a separate module from Support/Ordinance. It will organize members
          by where they live or fellowship and their assigned Pastoral Care leader,
          rather than by life events, support, or ordinances.
        </p>
        <div className="grid cols-2" style={{ gap: 14 }}>
          {PLANNED.map((item) => (
            <div key={item.title} className="row" style={{ gap: 12, alignItems: "flex-start", padding: 14, borderRadius: 12, background: "var(--bg-2)" }}>
              <div style={{ flexShrink: 0, color: "var(--gold-500)" }}><Icon name={item.icon} size={18} /></div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{item.title}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
