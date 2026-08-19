import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { useMembers } from "../../hooks/useMembers.js";
import {
  useLifeEvents, useCreateLifeEvent, useUpdateLifeEvent, useDeleteLifeEvent,
  useMemberSupport, useCreateMemberSupport, useUpdateMemberSupport, useDeleteMemberSupport,
  useSoulsWon, useCreateSoulWon, useDeleteSoulWon,
  useWaterBaptisms, useCreateWaterBaptism, useDeleteWaterBaptism,
  useHolySpiritBaptisms, useCreateHolySpiritBaptism, useDeleteHolySpiritBaptism,
} from "../../hooks/usePastoralCare.js";

const TABS = [
  { key: "life-events", label: "Life Events" },
  { key: "member-support", label: "Member Support" },
  { key: "evangelism", label: "Evangelism" },
];

const LIFE_EVENT_CATEGORIES = ["Naming", "Wedding", "Engagement", "Funeral"];
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function PastoralCarePage() {
  const { role } = useAuth();
  const access = accessLevel(role, "pastoral_care"); // "full" | "view" (route already blocks null)
  const canEdit = access === "full";
  const [tab, setTab] = useState(TABS[0].key);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Pastoral Care</div>
          <h1>Life events, support & evangelism</h1>
          <p>{canEdit ? "Track weddings, funerals, benevolence, and soul-winning." : "View-only — your role can't log entries here."}</p>
        </div>
      </div>

      <ScrollX style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 6, width: "max-content" }}>
          {TABS.map((t) => (
            <button key={t.key} className={"btn" + (tab === t.key ? " btn-primary" : " btn-ghost")} onClick={() => setTab(t.key)} style={{ flexShrink: 0 }}>
              {t.label}
            </button>
          ))}
        </div>
      </ScrollX>

      {tab === "life-events" && <LifeEventsSection canEdit={canEdit} />}
      {tab === "member-support" && <MemberSupportSection canEdit={canEdit} />}
      {tab === "evangelism" && <EvangelismSection canEdit={canEdit} />}
    </div>
  );
}

// ============== Life Events ==============

function LifeEventsSection({ canEdit }) {
  const { data: events, isLoading, isError, error } = useLifeEvents();
  const deleteEvent = useDeleteLifeEvent();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "16px 18px" }}>
        <h3 style={{ fontSize: 16 }}>Life events</h3>
        {canEdit && <button className="btn btn-primary" onClick={() => { setEditing(null); setShowAdd(true); }}><Icon name="plus" size={15} /> Add event</button>}
      </div>
      {isError && <div className="badge badge-red" style={{ display: "block", margin: "0 18px 14px", padding: "8px 12px" }}>Couldn't load: {error.message}</div>}
      <ScrollX>
        <table className="table">
          <thead><tr><th>Category</th><th>Date</th><th>Names</th><th>Venue</th><th>Attendance</th><th></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
            {!isLoading && (events ?? []).length === 0 && (
              <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: "center" }}>No life events logged yet.</td></tr>
            )}
            {(events ?? []).map((e) => (
              <tr key={e.id}>
                <td><span className="badge badge-blue">{e.category}</span></td>
                <td className="muted">{fmtDate(e.event_date)}</td>
                <td style={{ fontWeight: 500 }}>{e.names}</td>
                <td className="muted">{e.venue || "—"}</td>
                <td>{e.attendance ?? "—"}</td>
                <td>
                  {canEdit && (
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn btn-icon btn-ghost" onClick={() => { setEditing(e); setShowAdd(true); }}><Icon name="edit" size={14} /></button>
                      <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("Delete this life event?")) deleteEvent.mutate(e.id); }}><Icon name="trash" size={14} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      {showAdd && <LifeEventFormModal event={editing} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function LifeEventFormModal({ event, onClose }) {
  const [category, setCategory] = useState(event?.category ?? "Naming");
  const [eventDate, setEventDate] = useState(event?.event_date ?? new Date().toISOString().slice(0, 10));
  const [names, setNames] = useState(event?.names ?? "");
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [attendance, setAttendance] = useState(event?.attendance ?? "");
  const [error, setError] = useState(null);
  const createEvent = useCreateLifeEvent();
  const updateEvent = useUpdateLifeEvent();
  const saving = createEvent.isPending || updateEvent.isPending;

  const onSave = async () => {
    if (!names.trim()) return setError("Names are required.");
    const payload = { category, event_date: eventDate, names: names.trim(), venue: venue || null, attendance: attendance === "" ? null : Number(attendance) };
    try {
      if (event) await updateEvent.mutateAsync({ id: event.id, ...payload });
      else await createEvent.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this event.");
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 460, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>{event ? "Edit life event" : "Add life event"}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Category</label>
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {LIFE_EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Date</label><input type="date" className="input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></div>
          </div>
          <div className="field"><label>Names</label><input className="input" placeholder="e.g. Kwame & Ama" value={names} onChange={(e) => setNames(e.target.value)} /></div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field"><label>Venue</label><input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} /></div>
            <div className="field"><label>Attendance</label><input type="number" min="0" className="input" value={attendance} onChange={(e) => setAttendance(e.target.value)} /></div>
          </div>
        </div>
        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ============== Member Support ==============

function MemberSupportSection({ canEdit }) {
  const { data: entries, isLoading, isError, error } = useMemberSupport();
  const deleteEntry = useDeleteMemberSupport();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "16px 18px" }}>
        <h3 style={{ fontSize: 16 }}>Member support</h3>
        {canEdit && <button className="btn btn-primary" onClick={() => { setEditing(null); setShowAdd(true); }}><Icon name="plus" size={15} /> Add entry</button>}
      </div>
      {isError && <div className="badge badge-red" style={{ display: "block", margin: "0 18px 14px", padding: "8px 12px" }}>Couldn't load: {error.message}</div>}
      <ScrollX>
        <table className="table">
          <thead><tr><th>Type</th><th>Amount (GHS)</th><th>Date</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
            {!isLoading && (entries ?? []).length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: "center" }}>No support entries logged yet.</td></tr>
            )}
            {(entries ?? []).map((e) => (
              <tr key={e.id}>
                <td style={{ fontWeight: 500 }}>{e.support_type}</td>
                <td>{Number(e.amount_ghs).toFixed(2)}</td>
                <td className="muted">{fmtDate(e.support_date)}</td>
                <td className="muted" style={{ fontSize: 13 }}>{e.notes || "—"}</td>
                <td>
                  {canEdit && (
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn btn-icon btn-ghost" onClick={() => { setEditing(e); setShowAdd(true); }}><Icon name="edit" size={14} /></button>
                      <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("Delete this entry?")) deleteEntry.mutate(e.id); }}><Icon name="trash" size={14} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      {showAdd && <MemberSupportFormModal entry={editing} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function MemberSupportFormModal({ entry, onClose }) {
  const [supportType, setSupportType] = useState(entry?.support_type ?? "");
  const [q, setQ] = useState("");
  const [memberId, setMemberId] = useState(entry?.member_id ?? "");
  const { data: memberResults } = useMembers({ page: 0, pageSize: 20, search: q });
  const [amount, setAmount] = useState(entry?.amount_ghs ?? 0);
  const [supportDate, setSupportDate] = useState(entry?.support_date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [error, setError] = useState(null);
  const createEntry = useCreateMemberSupport();
  const updateEntry = useUpdateMemberSupport();
  const saving = createEntry.isPending || updateEntry.isPending;

  const onSave = async () => {
    if (!supportType.trim()) return setError("Support type is required.");
    const payload = { support_type: supportType.trim(), member_id: memberId || null, amount_ghs: Number(amount) || 0, support_date: supportDate, notes: notes || null };
    try {
      if (entry) await updateEntry.mutateAsync({ id: entry.id, ...payload });
      else await createEntry.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this entry.");
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 460, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>{entry ? "Edit support entry" : "Add support entry"}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field"><label>Support type</label><input className="input" placeholder="e.g. Hospital visit, Benevolence" value={supportType} onChange={(e) => setSupportType(e.target.value)} /></div>
          <div className="field">
            <label>Member (optional)</label>
            <input className="input" placeholder="Search member…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <select className="select" style={{ marginTop: 6 }} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">— None —</option>
                {(memberResults?.rows ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field"><label>Amount (GHS)</label><input type="number" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="field"><label>Date</label><input type="date" className="input" value={supportDate} onChange={(e) => setSupportDate(e.target.value)} /></div>
          </div>
          <div className="field"><label>Notes</label><textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ============== Evangelism ==============

function EvangelismSection({ canEdit }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <EvangelismSubTable
        title="Souls won" canEdit={canEdit}
        useList={useSoulsWon} useCreate={useCreateSoulWon} useDelete={useDeleteSoulWon}
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "contact", label: "Contact" },
          { key: "event_date", label: "Date", type: "date", default: () => new Date().toISOString().slice(0, 10) },
          { key: "brought_by", label: "Brought by" },
        ]}
        columns={[["name", "Name"], ["contact", "Contact"], ["event_date", "Date", fmtDate], ["brought_by", "Brought by"]]}
      />
      <EvangelismSubTable
        title="Water baptisms" canEdit={canEdit}
        useList={useWaterBaptisms} useCreate={useCreateWaterBaptism} useDelete={useDeleteWaterBaptism}
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "baptism_date", label: "Date", type: "date", default: () => new Date().toISOString().slice(0, 10) },
          { key: "notes", label: "Notes" },
        ]}
        columns={[["name", "Name"], ["baptism_date", "Date", fmtDate], ["notes", "Notes"]]}
      />
      <EvangelismSubTable
        title="Holy Spirit baptisms" canEdit={canEdit}
        useList={useHolySpiritBaptisms} useCreate={useCreateHolySpiritBaptism} useDelete={useDeleteHolySpiritBaptism}
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "baptism_date", label: "Date", type: "date", default: () => new Date().toISOString().slice(0, 10) },
          { key: "notes", label: "Notes" },
        ]}
        columns={[["name", "Name"], ["baptism_date", "Date", fmtDate], ["notes", "Notes"]]}
      />
    </div>
  );
}

// Small generic form+list for the three near-identical Evangelism tables —
// each only differs in its fields/columns, not its behavior.
function EvangelismSubTable({ title, canEdit, useList, useCreate, useDelete, fields, columns }) {
  const { data: rows, isLoading } = useList();
  const createRow = useCreate();
  const deleteRow = useDelete();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "14px 18px" }}>
        <h3 style={{ fontSize: 15 }}>{title}</h3>
        {canEdit && <button className="btn btn-ghost" style={{ fontSize: 12.5, height: 32 }} onClick={() => setShowAdd(true)}><Icon name="plus" size={13} /> Add</button>}
      </div>
      <ScrollX>
        <table className="table">
          <thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}{canEdit && <th></th>}</tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={columns.length + 1} className="muted" style={{ padding: 16, textAlign: "center" }}>Loading…</td></tr>}
            {!isLoading && (rows ?? []).length === 0 && (
              <tr><td colSpan={columns.length + 1} className="muted" style={{ padding: 16, textAlign: "center" }}>None logged yet.</td></tr>
            )}
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                {columns.map(([key, , fmt]) => <td key={key} className={key.includes("date") ? "muted" : ""}>{fmt ? fmt(r[key]) : (r[key] || "—")}</td>)}
                {canEdit && (
                  <td>
                    <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("Delete this entry?")) deleteRow.mutate(r.id); }}><Icon name="trash" size={13} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      {showAdd && <EvangelismFormModal title={title} fields={fields} onSave={(row) => createRow.mutateAsync(row)} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function EvangelismFormModal({ title, fields, onSave, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.default ? f.default() : ""])));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setValues((v) => ({ ...v, [key]: val }));

  const onSubmit = async () => {
    const required = fields.find((f) => f.required && !String(values[f.key] ?? "").trim());
    if (required) return setError(`${required.label} is required.`);
    setSaving(true);
    try {
      await onSave(values);
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 420, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>Add — {title}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fields.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <input type={f.type ?? "text"} className="input" value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} />
            </div>
          ))}
        </div>
        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
