import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { useMinistries } from "../../hooks/useMinistries.js";
import {
  useEvents, useCreateEvent, useDeleteEvent,
  useActivities, useCreateActivity, useDeleteActivity,
  useOtherActivities, useCreateOtherActivity, useDeleteOtherActivity,
  useMinutes, useCreateMinutes, useDeleteMinutes,
  useConventionAttendance, useCreateConventionAttendance, useDeleteConventionAttendance,
} from "../../hooks/useEvents.js";

const TABS = [
  { key: "events", label: "Events" },
  { key: "activities", label: "Activities" },
  { key: "minutes", label: "Minutes" },
  { key: "convention", label: "Convention Attendance" },
  { key: "other", label: "Other Activities" },
];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function EventsPage() {
  const { role, profile } = useAuth();
  const access = accessLevel(role, "events"); // "full" | "own" | "log" (route already blocks null)
  const [tab, setTab] = useState(TABS[0].key);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Events</div>
          <h1>Church activities & events</h1>
          <p>
            {access === "full" && "Log and manage events across the whole church."}
            {access === "own" && "Log and manage your own ministry's events."}
            {access === "log" && "Log general church-wide events."}
          </p>
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

      {tab === "events" && (
        <MinistryScopedSection
          title="Events" role={role} profile={profile} access={access}
          useList={useEvents} useCreate={useCreateEvent} useDelete={useDeleteEvent}
          fields={[
            { key: "title", label: "Title", required: true },
            { key: "event_date", label: "Date", type: "date", default: () => new Date().toISOString().slice(0, 10) },
            { key: "venue", label: "Venue" },
            { key: "description", label: "Description", type: "textarea" },
          ]}
          columns={[["title", "Title"], ["event_date", "Date", fmtDate], ["venue", "Venue"], ["ministries", "Ministry", (v) => v?.name ?? "General"]]}
        />
      )}
      {tab === "activities" && (
        <MinistryScopedSection
          title="Activity" role={role} profile={profile} access={access}
          useList={useActivities} useCreate={useCreateActivity} useDelete={useDeleteActivity}
          fields={[
            { key: "category", label: "Category", type: "select", options: ["National", "District", "Local", "Area"], required: true },
            { key: "activity_date", label: "Date", type: "date", default: () => new Date().toISOString().slice(0, 10) },
            { key: "theme", label: "Theme" },
            { key: "speaker_guest", label: "Speaker / guest" },
            { key: "venue", label: "Venue" },
            { key: "attendance", label: "Attendance", type: "number" },
          ]}
          columns={[["category", "Category"], ["activity_date", "Date", fmtDate], ["theme", "Theme"], ["attendance", "Attendance"]]}
        />
      )}
      {tab === "other" && (
        <MinistryScopedSection
          title="Activity" role={role} profile={profile} access={access}
          useList={useOtherActivities} useCreate={useCreateOtherActivity} useDelete={useDeleteOtherActivity}
          fields={[
            { key: "activity", label: "Activity", required: true },
            { key: "activity_date", label: "Date", type: "date", default: () => new Date().toISOString().slice(0, 10) },
            { key: "venue", label: "Venue" },
            { key: "attendance", label: "Attendance", type: "number" },
            { key: "comments", label: "Comments", type: "textarea" },
          ]}
          columns={[["activity", "Activity"], ["activity_date", "Date", fmtDate], ["attendance", "Attendance"], ["ministries", "Ministry", (v) => v?.name ?? "General"]]}
        />
      )}
      {tab === "minutes" && (
        <GeneralSection
          title="Minutes"
          useList={useMinutes} useCreate={useCreateMinutes} useDelete={useDeleteMinutes}
          fields={[
            { key: "meeting_date", label: "Meeting date", type: "date", default: () => new Date().toISOString().slice(0, 10) },
            { key: "content", label: "Minutes", type: "textarea", required: true },
          ]}
          columns={[["meeting_date", "Date", fmtDate], ["content", "Minutes", (v) => (v ?? "").slice(0, 80) + ((v ?? "").length > 80 ? "…" : "")]]}
        />
      )}
      {tab === "convention" && (
        <GeneralSection
          title="Convention attendance"
          useList={useConventionAttendance} useCreate={useCreateConventionAttendance} useDelete={useDeleteConventionAttendance}
          fields={[
            { key: "convention", label: "Convention", type: "select", options: ["Easter", "Christmas"], required: true },
            { key: "year", label: "Year", type: "number", default: () => new Date().getFullYear() },
            { key: "session", label: "Session" },
            { key: "attendance", label: "Attendance", type: "number" },
          ]}
          columns={[["convention", "Convention"], ["year", "Year"], ["session", "Session"], ["attendance", "Attendance"]]}
        />
      )}
    </div>
  );
}

// Shared by Events/Activities/Other Activities — all three carry an
// optional ministry_id and reuse the same secretary/ministry_leader
// scoping the RLS enforces (0013_events.sql).
function MinistryScopedSection({ title, role, profile, access, useList, useCreate, useDelete, fields, columns }) {
  const isMinistryLeader = role === "ministry_leader";
  const isSecretary = role === "secretary";
  const canPickScope = access === "full";
  const { data: rows, isLoading, isError, error } = useList();
  const createRow = useCreate();
  const deleteRow = useDelete();
  const { data: ministries } = useMinistries();
  const [showAdd, setShowAdd] = useState(false);
  const canDelete = access === "full" || access === "own";

  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "16px 18px" }}>
        <h3 style={{ fontSize: 16 }}>{title === "Activity" ? title + " log" : title}</h3>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} /> Add {title.toLowerCase()}</button>
      </div>
      {isError && <div className="badge badge-red" style={{ display: "block", margin: "0 18px 14px", padding: "8px 12px" }}>Couldn't load: {error.message}</div>}
      <ScrollX>
        <table className="table">
          <thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}<th></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={columns.length + 1} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
            {!isLoading && (rows ?? []).length === 0 && (
              <tr><td colSpan={columns.length + 1} className="muted" style={{ padding: 20, textAlign: "center" }}>Nothing logged yet.</td></tr>
            )}
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                {columns.map(([key, , fmt]) => <td key={key}>{fmt ? fmt(r[key]) : (r[key] ?? "—")}</td>)}
                <td>
                  {canDelete && (
                    <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("Delete this entry?")) deleteRow.mutate(r.id); }}><Icon name="trash" size={14} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      {showAdd && (
        <ScopedFormModal
          title={title} fields={fields}
          isMinistryLeader={isMinistryLeader} isSecretary={isSecretary} canPickScope={canPickScope}
          ministries={ministries ?? []} profile={profile}
          onSave={(row) => createRow.mutateAsync(row)}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function ScopedFormModal({ title, fields, isMinistryLeader, isSecretary, canPickScope, ministries, profile, onSave, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.default ? f.default() : ""])));
  const [scopeMinistryId, setScopeMinistryId] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setValues((v) => ({ ...v, [key]: val }));
  const effectiveMinistryId = isMinistryLeader ? (profile?.ministry_id ?? null) : (isSecretary ? null : (scopeMinistryId || null));

  const onSubmit = async () => {
    const required = fields.find((f) => f.required && !String(values[f.key] ?? "").trim());
    if (required) return setError(`${required.label} is required.`);
    setSaving(true);
    try {
      const row = { ...values, ministry_id: effectiveMinistryId };
      for (const f of fields) {
        if (f.type === "number" && row[f.key] !== "") row[f.key] = Number(row[f.key]);
        if (row[f.key] === "") row[f.key] = null;
      }
      await onSave(row);
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 460, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>Add {title.toLowerCase()}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {canPickScope && (
            <div className="field">
              <label>Ministry (optional — leave blank for church-wide)</label>
              <select className="select" value={scopeMinistryId} onChange={(e) => setScopeMinistryId(e.target.value)}>
                <option value="">General (church-wide)</option>
                {ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          {fields.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              {f.type === "select" ? (
                <select className="select" value={values[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea className="textarea" rows={3} value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <input type={f.type ?? "text"} className="input" value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              )}
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

// Minutes/Convention Attendance — no ministry concept, same form shape
// minus the scope picker.
function GeneralSection({ title, useList, useCreate, useDelete, fields, columns }) {
  const { data: rows, isLoading, isError, error } = useList();
  const createRow = useCreate();
  const deleteRow = useDelete();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "16px 18px" }}>
        <h3 style={{ fontSize: 16 }}>{title}</h3>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} /> Add</button>
      </div>
      {isError && <div className="badge badge-red" style={{ display: "block", margin: "0 18px 14px", padding: "8px 12px" }}>Couldn't load: {error.message}</div>}
      <ScrollX>
        <table className="table">
          <thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}<th></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={columns.length + 1} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
            {!isLoading && (rows ?? []).length === 0 && (
              <tr><td colSpan={columns.length + 1} className="muted" style={{ padding: 20, textAlign: "center" }}>Nothing logged yet.</td></tr>
            )}
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                {columns.map(([key, , fmt]) => <td key={key}>{fmt ? fmt(r[key]) : (r[key] ?? "—")}</td>)}
                <td><button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("Delete this entry?")) deleteRow.mutate(r.id); }}><Icon name="trash" size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      {showAdd && (
        <ScopedFormModal
          title={title} fields={fields}
          isMinistryLeader={false} isSecretary={false} canPickScope={false}
          ministries={[]} profile={null}
          onSave={(row) => { delete row.ministry_id; return createRow.mutateAsync(row); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
