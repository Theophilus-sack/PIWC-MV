import React from "react";
import { Icon } from "../components/Icon.jsx";

// Placeholder for modules whose nav entry, routing, and RBAC gating exist
// now (Phase 1) but whose real screen lands in a later phase. Swapped out
// module-by-module as each phase builds it.
export function ComingSoon({ title, phase }) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{phase}</div>
          <h1>{title}</h1>
          <p>This module's route and permissions are wired up — the screen itself is coming in {phase}.</p>
        </div>
      </div>
      <div className="glass card" style={{ padding: 40, textAlign: "center" }}>
        <Icon name="sparkle" size={22} />
        <p className="muted" style={{ marginTop: 10 }}>Nothing to see yet.</p>
      </div>
    </div>
  );
}
