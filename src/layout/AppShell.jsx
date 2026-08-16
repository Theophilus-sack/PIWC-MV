import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { Topbar } from "./Topbar.jsx";

// Ported from app.jsx's top-level <div className="app"> + ambient/grain
// decoration. Theme now persists to localStorage instead of the design
// tool's postMessage tweak protocol.
export function AppShell() {
  const [theme, setTheme] = useState(() => localStorage.getItem("piwc-theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("piwc-theme", theme);
  }, [theme]);

  return (
    <>
      <div className="ambient"><div className="orb" /></div>
      <div className="grain" />
      <div className="app">
        <Sidebar />
        <main className="main">
          <Topbar theme={theme} onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />
          <div className="content">
            <Outlet context={{ theme, setTheme }} />
          </div>
        </main>
      </div>
    </>
  );
}
