import React from "react";
import { Icon } from "./Icon.jsx";

// Extracted from Finance's Tithes/Missions year control (FinancePage.jsx's
// MonthlyPerformanceSection) once a 3rd and 4th caller needed the same
// prev-chevron/year-badge/next-chevron control, rather than copy-pasting it
// again — Designated Funds, Request Form, and Support/Ordinance's
// SectionToolbar all render this identically.
export function YearNav({ year, onPrev, onNext, style }) {
  return (
    <div className="row" style={{ gap: 8, ...style }}>
      <button className="btn btn-icon btn-ghost" onClick={onPrev}>
        <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><Icon name="chevron" size={14} stroke={2} /></span>
      </button>
      <span className="badge">{year}</span>
      <button className="btn btn-icon btn-ghost" onClick={onNext}><Icon name="chevron" size={14} stroke={2} /></button>
    </div>
  );
}
