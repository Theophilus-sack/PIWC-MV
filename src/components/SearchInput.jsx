import React from "react";
import { Icon } from "./Icon.jsx";

// The shared .search CSS class carries `flex: 1`, meant for horizontal
// filter-bar rows where it should grow to fill leftover width. Dropped
// into a *vertical* flex column instead (e.g. a sidebar panel), that same
// `flex: 1` fights a sibling for height instead, stretching the box well
// past its fixed 40px. `flex: "0 0 auto"` here overrides that so this
// component stays compact regardless of what kind of flex container it's
// placed in — safe to reuse anywhere without re-deriving this fix.
export function SearchInput({ value, onChange, placeholder, style }) {
  return (
    <div className="search" style={{ flex: "0 0 auto", maxWidth: "none", ...style }}>
      <Icon name="search" size={16} />
      <input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
