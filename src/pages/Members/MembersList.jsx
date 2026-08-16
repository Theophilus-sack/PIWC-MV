import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import { Avatar, Checkbox } from "../../components/primitives.jsx";
import { useMembers, useDeleteMember } from "../../hooks/useMembers.js";
import { useMinistries } from "../../hooks/useMinistries.js";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { AddMemberModal } from "./AddMemberModal.jsx";

const PAGE_SIZE = 20;

// Ported from the original screens.jsx Members screen (same markup/table
// pattern), but filtering/sorting/pagination now happen server-side via
// useMembers() instead of Array.filter over a client-held array — the
// real workbook has ~2000-row tabs, and that approach doesn't scale.
export function MembersList() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [ministryId, setMinistryId] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);

  const { data: ministries } = useMinistries();
  const { data, isLoading, isError, error } = useMembers({ page, pageSize: PAGE_SIZE, search: q, ministryId, sort });
  const deleteMember = useDeleteMember();

  const access = accessLevel(role, "members");
  const canAdd = access === "full";
  const canDelete = role === "super_admin";

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onSearchChange = (v) => { setQ(v); setPage(0); };
  const onMinistryChange = (v) => { setMinistryId(v); setPage(0); };
  const onSortChange = (v) => { setSort(v); setPage(0); };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Directory · {total} members</div>
          <h1>Members</h1>
          <p>Search, filter, and manage everyone in the church.</p>
        </div>
        {canAdd && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} /> Add member</button>
          </div>
        )}
      </div>

      <div className="glass card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="search" style={{ flex: 1, maxWidth: "none" }}>
            <Icon name="search" size={16} />
            <input placeholder="Search by name or phone…" value={q} onChange={(e) => onSearchChange(e.target.value)} />
            {q && <button className="btn btn-icon btn-ghost" onClick={() => onSearchChange("")}><Icon name="x" size={14} /></button>}
          </div>
          <select className="select" style={{ width: 190, height: 40 }} value={ministryId} onChange={(e) => onMinistryChange(e.target.value)}>
            <option value="">All ministries</option>
            {(ministries ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}{m.assembly ? ` (${m.assembly})` : ""}</option>)}
          </select>
          <select className="select" style={{ width: 190, height: 40 }} value={sort} onChange={(e) => onSortChange(e.target.value)}>
            <option value="recent">Sort · Recently joined</option>
            <option value="name">Sort · Name (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
        {isError && (
          <div style={{ padding: 20 }} className="badge badge-red">Couldn't load members: {error.message}</div>
        )}
        {!isError && (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}><Checkbox checked={false} onChange={() => {}} /></th>
                <th>Member</th>
                <th>Phone</th>
                <th>Gender</th>
                <th>Status</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ padding: 20, textAlign: "center" }}>No members match this search.</td></tr>
              )}
              {rows.map((m) => (
                <tr key={m.id} className="row-hover" onClick={() => navigate(`/members/${m.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}><Checkbox checked={false} onChange={() => {}} /></td>
                  <td>
                    <div className="row" style={{ gap: 12 }}>
                      <Avatar initials={initialsOf(m.name)} gold={m.gender === "Female"} size={34} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{m.name}</div>
                        <div className="faint" style={{ fontSize: 11 }}>{m.residence || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono muted" style={{ fontSize: 12.5 }}>{m.contact || "—"}</td>
                  <td><span className="badge">{m.gender || "—"}</span></td>
                  <td><span className={"badge" + (m.status === "first-timer" ? " badge-gold" : "")}>{m.status}</span></td>
                  <td className="muted">{m.date_joined ? new Date(m.date_joined).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {canDelete && (
                      <button className="btn btn-icon btn-ghost" onClick={() => {
                        if (confirm(`Delete ${m.name}? This can't be undone.`)) deleteMember.mutate(m.id);
                      }}>
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row between" style={{ padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {total > 0 ? `Showing ${page * PAGE_SIZE + 1}-${Math.min(total, (page + 1) * PAGE_SIZE)} of ${total}` : "No results"}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-icon btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><Icon name="chevron" size={14} /></span>
            </button>
            <span className="badge">{page + 1} / {pageCount}</span>
            <button className="btn btn-icon btn-ghost" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
              <Icon name="chevron" size={14} />
            </button>
          </div>
        </div>
      </div>

      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?";
}
