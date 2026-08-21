import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { Avatar, Checkbox } from "../../components/primitives.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { useMembers, useDeleteMember, useBulkDeleteMembers } from "../../hooks/useMembers.js";
import { useMinistries } from "../../hooks/useMinistries.js";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { ageBracketLabel } from "../../lib/ageBracket.js";
import { AddMemberModal } from "./AddMemberModal.jsx";
import { EditMemberModal } from "./EditMemberModal.jsx";
import { CsvImportModal, ExportCsvModal } from "../../components/CsvImportExport.jsx";

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
  const [assembly, setAssembly] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const { data: ministries } = useMinistries();
  const { data, isLoading, isError, error } = useMembers({ page, pageSize: PAGE_SIZE, search: q, ministryId, assembly, sort });
  const deleteMember = useDeleteMember();
  const bulkDeleteMembers = useBulkDeleteMembers();

  const access = accessLevel(role, "members");
  const canAdd = access === "full";
  const canEdit = access === "full";
  const canDelete = role === "super_admin";

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedRows = rows.filter((m) => selectedIds.has(m.id));
  // "Select all" is page-scoped (this project's existing convention —
  // Messages' recipient picker's "Select all visible" works the same
  // way) rather than fetching every matching row across all pages.
  const allVisibleSelected = rows.length > 0 && rows.every((m) => selectedIds.has(m.id));

  // A selection only makes sense against the rows it was made from —
  // clear it whenever the visible set changes underneath it.
  useEffect(() => { setSelectedIds(new Set()); }, [page, q, ministryId, assembly, sort]);

  const toggleRow = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectAll = () => setSelectedIds(allVisibleSelected ? new Set() : new Set(rows.map((m) => m.id)));

  const onBulkDelete = async () => {
    await bulkDeleteMembers.mutateAsync([...selectedIds]);
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  };

  const onSearchChange = (v) => { setQ(v); setPage(0); };
  const onMinistryChange = (v) => { setMinistryId(v); setPage(0); };
  const onAssemblyChange = (v) => { setAssembly(v); setPage(0); };
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
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={() => setShowImport(true)}><Icon name="upload" size={14} /> Import CSV</button>
            <button className="btn btn-ghost" onClick={() => setShowExport(true)}><Icon name="download" size={14} /> Export CSV</button>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} /> Add member</button>
          </div>
        )}
      </div>

      <div className="glass card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="row filter-bar" style={{ gap: 10 }}>
          <div className="search" style={{ flex: 1, maxWidth: "none" }}>
            <Icon name="search" size={16} />
            <input placeholder="Search by name or phone…" value={q} onChange={(e) => onSearchChange(e.target.value)} />
            {q && <button className="btn btn-icon btn-ghost" onClick={() => onSearchChange("")}><Icon name="x" size={14} /></button>}
          </div>
          <select className="select" style={{ width: 190, height: 40 }} value={ministryId} onChange={(e) => onMinistryChange(e.target.value)}>
            <option value="">All ministries</option>
            {(ministries ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}{m.assembly ? ` (${m.assembly})` : ""}</option>)}
          </select>
          <select className="select" style={{ width: 170, height: 40 }} value={assembly} onChange={(e) => onAssemblyChange(e.target.value)}>
            <option value="">All services</option>
            <option value="English">English Service</option>
            <option value="Twi">Twi Service</option>
          </select>
          <select className="select" style={{ width: 190, height: 40 }} value={sort} onChange={(e) => onSortChange(e.target.value)}>
            <option value="recent">Sort · Recently joined</option>
            <option value="name">Sort · Name (A-Z)</option>
          </select>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="glass card" style={{ padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{selectedIds.size} selected</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setSelectedIds(new Set())}>Clear</button>
            {canDelete && (
              <button className="btn" style={{ background: "rgba(207,67,67,0.12)", color: "#a83434", borderColor: "rgba(207,67,67,0.3)" }} onClick={() => setShowBulkDeleteConfirm(true)}>
                <Icon name="trash" size={14} /> Delete selected
              </button>
            )}
          </div>
        </div>
      )}

      <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
        {isError && (
          <div style={{ padding: 20 }} className="badge badge-red">Couldn't load members: {error.message}</div>
        )}
        {!isError && (
          <ScrollX>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}><Checkbox checked={allVisibleSelected} onChange={toggleSelectAll} /></th>
                <th>Member</th>
                <th>Phone</th>
                <th>Gender</th>
                <th>Age Bracket</th>
                <th>Status</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={8} className="muted" style={{ padding: 20, textAlign: "center" }}>No members match this search.</td></tr>
              )}
              {rows.map((m) => (
                <tr key={m.id} className="row-hover" onClick={() => navigate(`/members/${m.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.has(m.id)} onChange={() => toggleRow(m.id)} /></td>
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
                  <td className="muted">{ageBracketLabel(m.date_of_birth)}</td>
                  <td><span className={"badge" + (m.status === "first-timer" ? " badge-gold" : "")}>{m.status}</span></td>
                  <td className="muted">{m.date_joined ? new Date(m.date_joined).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row" style={{ gap: 4 }}>
                      {canEdit && (
                        <button className="btn btn-icon btn-ghost" onClick={() => setEditingMember(m)}>
                          <Icon name="edit" size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button className="btn btn-icon btn-ghost" onClick={() => {
                          if (confirm(`Delete ${m.name}? This can't be undone.`)) deleteMember.mutate(m.id);
                        }}>
                          <Icon name="trash" size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollX>
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
      {editingMember && <EditMemberModal member={editingMember} onClose={() => setEditingMember(null)} />}
      {showImport && (
        <CsvImportModal allowedTargets={["members"]} ministries={ministries} onClose={() => setShowImport(false)} />
      )}
      {showExport && (
        <ExportCsvModal
          allowedTargets={["members"]}
          filteredMembers={rows}
          filteredManualContacts={[]}
          selectedMembers={selectedRows}
          selectedManualContacts={[]}
          allowSelected={selectedRows.length > 0}
          onClose={() => setShowExport(false)}
        />
      )}
      {showBulkDeleteConfirm && (
        <ConfirmBulkDeleteModal
          count={selectedIds.size}
          deleting={bulkDeleteMembers.isPending}
          onConfirm={onBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function ConfirmBulkDeleteModal({ count, deleting, onConfirm, onCancel }) {
  return (
    <Modal onClose={deleting ? () => {} : onCancel}>
      <div className="glass modal-card" style={{ maxWidth: 420, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ gap: 10, marginBottom: 14 }}>
          <div style={{ color: "#a83434" }}><Icon name="trash" size={20} /></div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 500 }}>Delete {count} member{count === 1 ? "" : "s"}?</h2>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginBottom: 8 }}>
          This will permanently delete {count === 1 ? "this member record" : `these ${count} member records`}, along with their
          ministry/department memberships and attendance history.
        </p>
        <div className="badge badge-red" style={{ display: "block", padding: "8px 12px" }}>
          This action cannot be undone.
        </div>
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button
            className="btn"
            style={{ background: "#a83434", color: "#fff", borderColor: "#a83434" }}
            onClick={onConfirm}
            disabled={deleting}
          >
            <Icon name="trash" size={14} /> {deleting ? "Deleting…" : `Delete ${count} member${count === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?";
}
