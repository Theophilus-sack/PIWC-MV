import React from "react";
import { NavLink } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { Avatar } from "../components/primitives.jsx";
import { useAuth } from "../lib/auth.jsx";
import { navForRole, ROLE_LABELS } from "../lib/rbac.js";

function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?";
}

// Ported from the original app.jsx <aside> markup — same classes/layout,
// nav list is now role-filtered and routed instead of a hardcoded 4-item array.
// On mobile this becomes an off-canvas drawer (see .sidebar CSS media
// query) — `open`/`onClose` only matter below that breakpoint; at desktop
// widths the sidebar is always visible regardless of `open`.
export function Sidebar({ open, onClose }) {
  const { profile, role, signOut } = useAuth();
  const items = navForRole(role);

  return (
    <aside className={"sidebar glass" + (open ? " sidebar-open" : "")} data-screen-label="Sidebar">
      <div className="brand">
        <div className="brand-mark">
          <img src="/assets/logo-mark.png" alt="" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="brand-name">Mountain View</div>
          <div className="brand-sub">PIWC · CMS</div>
        </div>
        <button className="btn btn-icon btn-ghost sidebar-close" onClick={onClose} aria-label="Close menu">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="sidebar-nav-scroll">
        <div className="nav-section">Workspace</div>
        {items.map((n) => (
          <NavLink
            key={n.key}
            to={n.path}
            end={n.path === "/"}
            className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
          >
            <Icon name={n.icon} size={17} />
            <span>{n.label}</span>
          </NavLink>
        ))}

        <div className="nav-section">System</div>
        <NavLink to="/settings" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          <Icon name="settings" size={17} /><span>Settings</span>
        </NavLink>
      </div>

      <div className="glass-soft" style={{ padding: 12, marginBottom: 8, flexShrink: 0 }}>
        <div className="row" style={{ gap: 10 }}>
          <Avatar initials={initialsOf(profile?.full_name)} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {profile?.full_name ?? "…"}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className="badge badge-gold" style={{ fontSize: 10 }}>{ROLE_LABELS[role] ?? role}</span>
            </div>
          </div>
          <button className="btn btn-icon btn-ghost" title="Sign out" onClick={signOut}>
            <Icon name="logout" size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
