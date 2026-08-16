import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Switch } from "../components/primitives.jsx";
import { useAuth } from "../lib/auth.jsx";
import { ROLE_LABELS } from "../lib/rbac.js";

// Ported from screens.jsx's Settings, trimmed to what's real in Phase 1:
// appearance is a genuine per-device preference; the old "switch role"
// card was a demo toggle and is gone now that role comes from the
// database. "Church profile" fields move to the Admin module once that's
// built (Phase 6) rather than living here unsaved.
export function SettingsPage() {
  const { theme, setTheme } = useOutletContext();
  const { profile, role } = useAuth();
  const [density, setDensity] = useState("comfortable");

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Workspace</div>
          <h1>Settings</h1>
          <p>Personalise the CMS for your own device.</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="glass card">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Appearance</h3>
          <div className="row between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line-2)" }}>
            <div><div style={{ fontWeight: 500 }}>Dark mode</div><div className="muted" style={{ fontSize: 12.5 }}>Easier on the eyes during late evening services.</div></div>
            <Switch on={theme === "dark"} onChange={(v) => setTheme(v ? "dark" : "light")} />
          </div>
          <div className="row between" style={{ padding: "10px 0" }}>
            <div><div style={{ fontWeight: 500 }}>Compact density</div><div className="muted" style={{ fontSize: 12.5 }}>Show more rows in tables.</div></div>
            <Switch on={density === "compact"} onChange={(v) => setDensity(v ? "compact" : "comfortable")} />
          </div>
        </div>

        <div className="glass card">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Your account</h3>
          <div className="row between" style={{ padding: "8px 0" }}>
            <span className="muted">Name</span><span>{profile?.full_name ?? "—"}</span>
          </div>
          <div className="row between" style={{ padding: "8px 0" }}>
            <span className="muted">Role</span><span className="badge badge-gold">{ROLE_LABELS[role] ?? role}</span>
          </div>
          <div className="divider" />
          <p className="muted" style={{ fontSize: 12.5 }}>
            Roles are assigned by a Super Admin or Pastor. Contact them if this needs to change.
          </p>
        </div>
      </div>
    </div>
  );
}
