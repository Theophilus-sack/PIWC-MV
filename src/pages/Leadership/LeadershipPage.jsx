import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { usePresbyters, useMinistryLeadership, useCreatePresbyter, useCreateMinistryLeader } from "../../hooks/useLeadership.js";
import { useMinistries } from "../../hooks/useMinistries.js";

export function LeadershipPage() {
  const { role } = useAuth();
  const canManage = accessLevel(role, "leadership") === "full";

  const { data: presbyters, isLoading: presbytersLoading } = usePresbyters();
  const { data: leadership, isLoading: leadershipLoading } = useMinistryLeadership();
  const [addingPresbyter, setAddingPresbyter] = useState(false);
  const [addingLeader, setAddingLeader] = useState(false);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Directory</div>
          <h1>Leadership</h1>
          <p>Presbyters and ministry leadership across the church.</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="glass card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 16 }}>Presbyters</h3>
            {canManage && <button className="btn btn-ghost" onClick={() => setAddingPresbyter(true)}><Icon name="plus" size={14} /> Add</button>}
          </div>
          {presbytersLoading && <p className="muted">Loading…</p>}
          {(presbyters ?? []).map((p) => (
            <div key={p.id} className="row between" style={{ padding: "10px 0", borderTop: "1px solid var(--line-2)" }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</span>
              <span className="muted mono" style={{ fontSize: 12.5 }}>{p.contact || "—"}</span>
            </div>
          ))}
          {!presbytersLoading && (presbyters ?? []).length === 0 && <p className="muted" style={{ fontSize: 13 }}>None recorded yet.</p>}
        </div>

        <div className="glass card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 16 }}>Ministry leadership</h3>
            {canManage && <button className="btn btn-ghost" onClick={() => setAddingLeader(true)}><Icon name="plus" size={14} /> Add</button>}
          </div>
          {leadershipLoading && <p className="muted">Loading…</p>}
          {(leadership ?? []).map((l) => (
            <div key={l.id} className="row between" style={{ padding: "10px 0", borderTop: "1px solid var(--line-2)" }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{l.leader_name}</div>
                <div className="faint" style={{ fontSize: 11.5 }}>{l.ministries?.name} · {l.portfolio}</div>
              </div>
              <span className="muted mono" style={{ fontSize: 12.5 }}>{l.contact || "—"}</span>
            </div>
          ))}
          {!leadershipLoading && (leadership ?? []).length === 0 && <p className="muted" style={{ fontSize: 13 }}>None recorded yet.</p>}
        </div>
      </div>

      {addingPresbyter && <AddPresbyterModal onClose={() => setAddingPresbyter(false)} />}
      {addingLeader && <AddMinistryLeaderModal onClose={() => setAddingLeader(false)} />}
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--blue-900) 40%, transparent)", backdropFilter: "blur(8px)", padding: 24 }}
      onClick={onClose}
    >
      <div className="glass" style={{ width: "100%", maxWidth: 440, padding: 26, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>{title}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddPresbyterModal({ onClose }) {
  const [form, setForm] = useState({ name: "", contact: "" });
  const [error, setError] = useState(null);
  const create = useCreatePresbyter();

  const onSave = async () => {
    if (!form.name.trim()) return setError("Name is required.");
    try {
      await create.mutateAsync(form);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <ModalShell title="Add presbyter" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field"><label>Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field"><label>Contact</label><input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
      </div>
      {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
      <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={create.isPending}>Save</button>
      </div>
    </ModalShell>
  );
}

function AddMinistryLeaderModal({ onClose }) {
  const { data: ministries } = useMinistries();
  const [form, setForm] = useState({ ministry_id: "", leader_name: "", portfolio: "President", contact: "" });
  const [error, setError] = useState(null);
  const create = useCreateMinistryLeader();

  const onSave = async () => {
    if (!form.leader_name.trim() || !form.ministry_id) return setError("Ministry and name are required.");
    try {
      await create.mutateAsync(form);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <ModalShell title="Add ministry leader" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field">
          <label>Ministry</label>
          <select className="select" value={form.ministry_id} onChange={(e) => setForm({ ...form, ministry_id: e.target.value })}>
            <option value="">Select a ministry…</option>
            {(ministries ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Leader name</label><input className="input" value={form.leader_name} onChange={(e) => setForm({ ...form, leader_name: e.target.value })} /></div>
        <div className="field"><label>Portfolio</label><input className="input" value={form.portfolio} onChange={(e) => setForm({ ...form, portfolio: e.target.value })} /></div>
        <div className="field"><label>Contact</label><input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
      </div>
      {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
      <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={create.isPending}>Save</button>
      </div>
    </ModalShell>
  );
}
