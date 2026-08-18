import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { useAuditLogs } from "../../hooks/useAuditLogs.js";
import { useProfiles } from "../../hooks/useProfiles.js";

const TARGET_TABLES = [
  "profiles", "members", "sms_batches", "sms_templates", "manual_contacts",
  "message_automations", "sermon_notes",
];

// Read-only, Super Admin/Pastor only (rbac's audit_logs module, backed by
// audit_logs' RLS — see 0001_foundation.sql). Every write here happened
// through log_audit_event(), the same security-definer helper every
// phase's audit triggers call — this page doesn't have its own logging
// path to keep in sync with, it just reads what's already there.
export function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [targetTable, setTargetTable] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: logs, isLoading, isError, error } = useAuditLogs({ action, targetTable, from, to });
  const { data: profiles } = useProfiles();
  const [viewingLog, setViewingLog] = useState(null);

  const nameByActor = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>System</div>
          <h1>Audit logs</h1>
          <p>Append-only record of sensitive actions — nothing here can be edited or deleted, by anyone.</p>
        </div>
      </div>

      <div className="glass card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="row filter-bar" style={{ gap: 10 }}>
          <div className="search" style={{ flex: 1, maxWidth: "none" }}>
            <Icon name="search" size={15} />
            <input placeholder="Search action…" value={action} onChange={(e) => setAction(e.target.value)} />
          </div>
          <select className="select" style={{ width: 190 }} value={targetTable} onChange={(e) => setTargetTable(e.target.value)}>
            <option value="">All tables</option>
            {TARGET_TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" className="input" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
          <input type="date" className="input" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} title="To" />
        </div>
      </div>

      <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
        {isError && (
          <div className="badge badge-red" style={{ display: "block", margin: 18, padding: "8px 12px" }}>
            Couldn't load audit logs: {error.message}
          </div>
        )}
        <ScrollX>
          <table className="table">
            <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Target</th><th></th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
              {!isLoading && (logs ?? []).length === 0 && (
                <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: "center" }}>No audit entries match.</td></tr>
              )}
              {(logs ?? []).map((l) => (
                <tr key={l.id} className="row-hover" onClick={() => setViewingLog(l)}>
                  <td className="muted">{new Date(l.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{nameByActor.get(l.actor_id) ?? "—"}</td>
                  <td><span className="badge badge-blue">{l.action}</span></td>
                  <td className="mono muted" style={{ fontSize: 12.5 }}>{l.target_table}{l.target_id ? ` · ${l.target_id.slice(0, 8)}…` : ""}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-icon btn-ghost" onClick={() => setViewingLog(l)}><Icon name="eye" size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </div>

      {viewingLog && <AuditLogDetailModal log={viewingLog} actorName={nameByActor.get(viewingLog.actor_id)} onClose={() => setViewingLog(null)} />}
    </div>
  );
}

function AuditLogDetailModal({ log, actorName, onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ width: "100%", maxWidth: 560, padding: 26, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500 }}>{log.action}</h2>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {actorName ?? "Unknown actor"} · {new Date(log.created_at).toLocaleString()}
            </p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <span className="badge">{log.target_table}</span>
          {log.target_id && <span className="badge mono">{log.target_id}</span>}
        </div>
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {log.before && (
            <div>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Before</div>
              <pre className="glass-soft mono" style={{ padding: 12, fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {JSON.stringify(log.before, null, 2)}
              </pre>
            </div>
          )}
          {log.after && (
            <div>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>After</div>
              <pre className="glass-soft mono" style={{ padding: 12, fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {JSON.stringify(log.after, null, 2)}
              </pre>
            </div>
          )}
          {!log.before && !log.after && <p className="muted" style={{ fontSize: 13 }}>No before/after data recorded for this action.</p>}
        </div>
      </div>
    </Modal>
  );
}
