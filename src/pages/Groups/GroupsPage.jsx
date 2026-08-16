import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Avatar } from "../../components/primitives.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { useMinistries, useMinistryRoster, useAddMinistryMember, useRemoveMinistryMember } from "../../hooks/useMinistries.js";
import { useMembers } from "../../hooks/useMembers.js";

export function GroupsPage() {
  const { role, profile } = useAuth();
  const { data: ministries, isLoading } = useMinistries();
  const isMinistryLeader = role === "ministry_leader";
  const [selected, setSelected] = useState(null);

  const activeMinistryId = isMinistryLeader ? profile?.ministry_id : selected;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Ministries</div>
          <h1>Groups/Ministries</h1>
          <p>{isMinistryLeader ? "Manage your ministry's roster." : "Browse ministries and their rosters."}</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: isMinistryLeader ? "1fr" : "280px 1fr", gap: 14 }}>
        {!isMinistryLeader && (
          <div className="glass card" style={{ padding: 10 }}>
            {isLoading && <p className="muted" style={{ padding: 10 }}>Loading…</p>}
            {(ministries ?? []).map((m) => (
              <div
                key={m.id}
                className="nav-item"
                style={{ cursor: "pointer" }}
                onClick={() => setSelected(m.id)}
                data-active={m.id === selected}
              >
                <span style={{ fontWeight: m.id === selected ? 600 : 400 }}>{m.name}</span>
              </div>
            ))}
          </div>
        )}

        {activeMinistryId ? (
          <Roster ministryId={activeMinistryId} ministryName={ministries?.find((m) => m.id === activeMinistryId)?.name} role={role} />
        ) : (
          <div className="glass card" style={{ padding: 40, textAlign: "center" }}>
            <p className="muted">Pick a ministry to see its roster.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Roster({ ministryId, ministryName, role }) {
  const access = accessLevel(role, "groups");
  const canManage = access === "full" || access === "own";
  const { data: roster, isLoading } = useMinistryRoster(ministryId);
  const addMember = useAddMinistryMember();
  const removeMember = useRemoveMinistryMember();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="glass card">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div>
          <div className="eyebrow">Roster</div>
          <h3 style={{ fontSize: 18, marginTop: 4 }}>{ministryName} · {(roster ?? []).length} members</h3>
        </div>
        {canManage && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} /> Add member</button>}
      </div>

      {isLoading && <p className="muted">Loading…</p>}
      {(roster ?? []).map((r) => (
        <div key={r.id} className="row between" style={{ padding: "10px 0", borderTop: "1px solid var(--line-2)" }}>
          <div className="row" style={{ gap: 12 }}>
            <Avatar initials={initialsOf(r.members?.name)} gold={r.members?.gender === "Female"} size={32} />
            <span style={{ fontWeight: 500, fontSize: 14 }}>{r.members?.name}</span>
          </div>
          {canManage && (
            <button className="btn btn-icon btn-ghost" onClick={() => removeMember.mutate({ id: r.id, ministryId })}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      ))}
      {!isLoading && (roster ?? []).length === 0 && <p className="muted" style={{ fontSize: 13 }}>No members in this ministry yet.</p>}

      {showAdd && (
        <AddToRosterModal
          ministryId={ministryId}
          existingIds={(roster ?? []).map((r) => r.member_id)}
          onAdd={(memberId) => addMember.mutate({ ministryId, memberId })}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function AddToRosterModal({ ministryId, existingIds, onAdd, onClose }) {
  const [q, setQ] = useState("");
  const { data } = useMembers({ page: 0, pageSize: 20, search: q });
  const candidates = (data?.rows ?? []).filter((m) => !existingIds.includes(m.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass" style={{ width: "100%", maxWidth: 440, padding: 26, maxHeight: "70vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>Add to roster</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="search" style={{ maxWidth: "none", marginBottom: 12 }}>
          <Icon name="search" size={16} />
          <input placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ overflowY: "auto" }}>
          {candidates.map((m) => (
            <div key={m.id} className="row between" style={{ padding: "8px 0" }}>
              <span style={{ fontSize: 14 }}>{m.name}</span>
              <button className="btn btn-ghost" onClick={() => { onAdd(m.id); onClose(); }}>Add</button>
            </div>
          ))}
          {candidates.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No matches.</p>}
        </div>
      </div>
    </div>
  );
}

function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?";
}
