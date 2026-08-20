import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { Topbar } from "./Topbar.jsx";
import { SessionTimeoutWatcher } from "../components/SessionTimeoutWatcher.jsx";

// Ported from app.jsx's top-level <div className="app"> + ambient/grain
// decoration. Theme now persists to localStorage instead of the design
// tool's postMessage tweak protocol.
export function AppShell() {
  const [theme, setTheme] = useState(() => localStorage.getItem("piwc-theme") || "light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("piwc-theme", theme);
  }, [theme]);

  // Close the mobile drawer on every navigation — otherwise it stays open
  // after tapping a nav link, covering the page you just navigated to.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <>
      <SessionTimeoutWatcher />
      <div className="ambient"><div className="orb" /></div>
      <div className="grain" />
      <div className="app">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}
        <main className="main">
          <Topbar theme={theme} onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} onMenuClick={() => setSidebarOpen(true)} />
          <div className="content">
            <Outlet context={{ theme, setTheme }} />
          </div>
        </main>
      </div>
    </>
  );
}
