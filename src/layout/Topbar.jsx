import React from "react";
import { useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { NAV_ITEMS } from "../lib/rbac.js";

const SECTION_LABEL = { "/settings": "Workspace" };

// Ported from app.jsx's <div className="topbar">. onMenuClick opens the
// mobile sidebar drawer — the button itself is hidden at desktop widths
// via CSS (.menu-toggle), where the sidebar is always visible instead.
export function Topbar({ theme, onToggleTheme, onMenuClick }) {
  const { pathname } = useLocation();
  const current = NAV_ITEMS.find((n) => n.path === pathname);
  const title = current?.label ?? SECTION_LABEL[pathname] ?? "Mountain View";

  return (
    <div className="topbar glass" data-screen-label="Topbar">
      <button className="btn btn-icon btn-ghost menu-toggle" onClick={onMenuClick} aria-label="Open menu">
        <Icon name="menu" size={17} />
      </button>
      <div className="row breadcrumb" style={{ gap: 10, flex: 1 }}>
        <span className="muted" style={{ fontSize: 12.5 }}>PIWC Mountain View</span>
        <span className="faint">/</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{title}</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-icon btn-ghost" onClick={onToggleTheme} title="Toggle theme">
          <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
        </button>
        <button className="btn btn-icon btn-ghost" title="Notifications" style={{ position: "relative" }}>
          <Icon name="bell" size={16} />
          <span style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: "50%", background: "var(--gold-500)", border: "1.5px solid var(--bg-1)" }} />
        </button>
      </div>
    </div>
  );
}
