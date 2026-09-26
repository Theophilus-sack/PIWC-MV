import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.jsx";
import { useMembers, useMember } from "../hooks/useMembers.js";

// Shared searchable member selector — generalised from the inline search-
// then-pick pattern that used to live only in SupportOrdinancePage's
// MemberSupportFormModal. Any form that must reference an existing
// `members` row (Support, and now Leadership's Presbyter/Ministry Leader
// forms) uses this instead of duplicating that logic or, worse, accepting
// a free-text name a fabricated/nonexistent person could be saved under.
//
// Selecting a result is the ONLY way to produce a value — typed text
// alone never counts as a selection (the search input's own value is
// local UI state, never passed to onSelect), and the parent only ever
// sees a real members.id once a result has actually been clicked.
//
// Props:
//  - value: selected member's uuid, or "" / null / undefined
//  - selectedMember: optional {id, name, contact, ...} to render
//    immediately (e.g. a list query's joined member row) without waiting
//    on a fetch; if omitted while `value` is set, the member is fetched
//    by id so a bare id is still enough to render the selected state.
//  - onSelect(member): called with the full member row on click
//  - onChange: called when "Change" is pressed (typically clears value)
//  - placeholder: search input placeholder
export function MemberPicker({ value, selectedMember, onSelect, onChange, placeholder = "Search members by name…" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const { data } = useMembers({ page: 0, pageSize: 8, search: query.trim(), sort: "name" });
  const results = query.trim() ? (data?.rows ?? []) : [];

  const needsFetch = Boolean(value) && !selectedMember;
  const { data: fetchedMember } = useMember(needsFetch ? value : undefined);
  const current = selectedMember ?? (needsFetch ? fetchedMember : null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const pick = (member) => {
    onSelect(member);
    setQuery("");
    setOpen(false);
  };

  const startChange = () => {
    setQuery("");
    setOpen(true);
    onChange?.();
  };

  if (value && current) {
    return (
      <div className="row between" style={{ gap: 10, padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 10 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{current.name}</div>
          <div className="muted" style={{ fontSize: 12 }}>{current.contact || "—"}</div>
        </div>
        <button type="button" className="btn btn-ghost" style={{ height: 30, fontSize: 12.5, flexShrink: 0 }} onClick={startChange}>
          Change
        </button>
      </div>
    );
  }

  // Selected id set, but its member row hasn't resolved yet — avoid
  // flashing the search box while the fallback fetch is in flight.
  if (value && !current) {
    return <div className="muted" style={{ fontSize: 13, padding: "9px 12px" }}>Loading selected member…</div>;
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div className="search" style={{ maxWidth: "none" }}>
        <Icon name="search" size={15} />
        <input
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && query.trim() && (
        <div
          className="glass-soft"
          style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, maxHeight: 220, overflowY: "auto", padding: 6 }}
        >
          {results.map((m) => (
            <div
              key={m.id}
              className="nav-item"
              style={{ display: "block" }}
              onMouseDown={(e) => e.preventDefault()} // click fires before the input's blur would close the list
              onClick={() => pick(m)}
            >
              <div style={{ fontWeight: 500, fontSize: 13.5 }}>{m.name}</div>
              <div className="faint" style={{ fontSize: 11 }}>
                {m.member_id || `${m.id.slice(0, 8)}…`}{m.contact ? ` · ${m.contact}` : ""}
              </div>
            </div>
          ))}
          {results.length === 0 && <p className="muted" style={{ fontSize: 13, padding: "8px 10px", margin: 0 }}>No matches.</p>}
        </div>
      )}
    </div>
  );
}
