import React, { useEffect, useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { Avatar, Checkbox, Switch } from "../../components/primitives.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { smsSegmentInfo, SMS_STATUS_LABELS } from "../../lib/sms.js";
import { useMinistries, useMinistryRoster } from "../../hooks/useMinistries.js";
import { useMembers } from "../../hooks/useMembers.js";
import {
  useSmsTemplates, useCreateTemplate, useDeleteTemplate,
  useSmsBatches, useSmsBatchMessages, useSmsBalance, useSendSms,
} from "../../hooks/useMessages.js";

const TABS = [
  { key: "send", label: "Send" },
  { key: "templates", label: "Templates" },
  { key: "logs", label: "Logs" },
];

const STATUS_BADGE = {
  queued: "badge-gold",
  sending: "badge-blue",
  sent: "badge-green",
  delivered: "badge-green",
  failed: "badge-red",
  partially_failed: "badge-gold",
};

function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?";
}

// Ported to a real module for Phase 4 — the Send/Templates/Logs tabs match
// the spec's "Send Now/Scheduled/Templates/Logs" shape (Automation wasn't
// specced further than that heading, so it's not built as a separate tab
// yet). Recipient scope is enforced client-side purely for UX (hiding
// controls a role couldn't use anyway) — sms_batches/sms_messages RLS in
// 0009_messaging.sql is the actual authority, same split as every other
// module.
export function MessagesPage() {
  const { role, profile } = useAuth();
  const access = accessLevel(role, "messages"); // "full" | "own" | "send" | "view" (route already blocks null)
  const canSend = access !== "view";
  const canManageTemplates = access === "full";

  const tabs = TABS.filter((t) => t.key !== "send" || canSend);
  const [tab, setTab] = useState(tabs[0].key);
  const [prefillBody, setPrefillBody] = useState(null);

  const { data: balance } = useSmsBalance();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Messages</div>
          <h1>Send SMS to members & ministries</h1>
          <p>
            {access === "full" && "Compose and send to any ministry or the whole church."}
            {access === "own" && "Compose and send to your own ministry."}
            {access === "send" && "Compose and send general church-wide messages."}
            {access === "view" && "View-only — your role can't send messages."}
          </p>
        </div>
        <div className="badge badge-blue">
          <Icon name="bell" size={12} /> Balance: {balance ? `${balance.currency} ${balance.balance.toFixed(2)}` : "…"}
        </div>
      </div>

      <ScrollX style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 6, width: "max-content" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={"btn" + (tab === t.key ? " btn-primary" : " btn-ghost")}
              onClick={() => setTab(t.key)}
              style={{ flexShrink: 0 }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </ScrollX>

      {tab === "send" && canSend && (
        <SendTab
          role={role}
          profile={profile}
          access={access}
          prefillBody={prefillBody}
          onConsumePrefill={() => setPrefillBody(null)}
        />
      )}
      {tab === "templates" && (
        <TemplatesTab canManage={canManageTemplates} onUse={(body) => { setPrefillBody(body); setTab("send"); }} />
      )}
      {tab === "logs" && <LogsTab />}
    </div>
  );
}

// ============== Send ==============

function SendTab({ role, profile, access, prefillBody, onConsumePrefill }) {
  const isMinistryLeader = role === "ministry_leader";
  const isSecretary = role === "secretary";
  const canPickScope = access === "full"; // super_admin / comms_media

  const { data: ministries } = useMinistries();
  const [scopeMinistryId, setScopeMinistryId] = useState(""); // "" = General
  const effectiveMinistryId = isMinistryLeader
    ? (profile?.ministry_id ?? null)
    : (isSecretary ? null : (scopeMinistryId || null));

  const [q, setQ] = useState("");
  const { data: ministryRoster } = useMinistryRoster(effectiveMinistryId);
  const { data: generalMembers } = useMembers({ page: 0, pageSize: 50, search: q });

  const candidates = effectiveMinistryId
    ? (ministryRoster ?? []).map((r) => r.members).filter((m) => m && (!q || m.name.toLowerCase().includes(q.toLowerCase())))
    : (generalMembers?.rows ?? []);

  // Keyed by id -> member, not derived by filtering `candidates` — that
  // would silently drop previously-selected recipients from the count the
  // moment a new search narrows the visible list.
  const [selected, setSelected] = useState(new Map());
  useEffect(() => { setSelected(new Map()); }, [effectiveMinistryId]);

  const toggle = (member) => setSelected((prev) => {
    const next = new Map(prev);
    if (next.has(member.id)) next.delete(member.id); else next.set(member.id, member);
    return next;
  });
  const selectAllVisible = () => setSelected((prev) => {
    const next = new Map(prev);
    candidates.forEach((m) => next.set(m.id, m));
    return next;
  });
  const clearSelection = () => setSelected(new Map());
  const selectedMembers = Array.from(selected.values());
  const missingPhoneCount = selectedMembers.filter((m) => !m.contact).length;

  const { data: templates } = useSmsTemplates();
  const [templateId, setTemplateId] = useState("");
  const [body, setBody] = useState("");
  useEffect(() => {
    if (prefillBody != null) {
      setBody(prefillBody);
      onConsumePrefill();
    }
  }, [prefillBody, onConsumePrefill]);

  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [feedback, setFeedback] = useState(null);

  const sendSms = useSendSms();
  const segInfo = smsSegmentInfo(body);

  const applyTemplate = (id) => {
    setTemplateId(id);
    const t = (templates ?? []).find((t) => t.id === id);
    if (t) setBody(t.body);
  };

  const onSend = async () => {
    setFeedback(null);
    const recipients = selectedMembers.filter((m) => m.contact).map((m) => ({ memberId: m.id, name: m.name, phone: m.contact }));
    if (recipients.length === 0) {
      setFeedback({ type: "error", text: "None of the selected members have a phone number on file." });
      return;
    }
    try {
      const result = await sendSms.mutateAsync({
        body,
        recipients,
        ministryId: effectiveMinistryId,
        templateId: templateId || null,
        scheduledAt: scheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
      if (result.scheduled) {
        setFeedback({ type: "success", text: `Scheduled for ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.` });
      } else {
        const { sentCount, failedCount } = result.sendResult ?? {};
        setFeedback({
          type: failedCount ? "error" : "success",
          text: `Sent ${sentCount ?? recipients.length}${failedCount ? `, ${failedCount} failed` : ""}.`,
        });
      }
      setSelected(new Map());
      setBody("");
      setTemplateId("");
      setScheduled(false);
      setScheduledAt("");
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Couldn't send." });
    }
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 340px", gap: 14 }}>
      <div className="glass card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {canPickScope && (
          <div className="field">
            <label>Sending to</label>
            <select className="select" value={scopeMinistryId} onChange={(e) => setScopeMinistryId(e.target.value)}>
              <option value="">General (search all members)</option>
              {(ministries ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.assembly ? ` (${m.assembly})` : ""}</option>
              ))}
            </select>
          </div>
        )}
        {isMinistryLeader && (
          <div className="badge badge-blue" style={{ alignSelf: "flex-start" }}>
            Sending to: {ministries?.find((m) => m.id === profile?.ministry_id)?.name ?? "your ministry"}
          </div>
        )}
        {isSecretary && (
          <div className="badge badge-blue" style={{ alignSelf: "flex-start" }}>Sending to: General (all members)</div>
        )}

        {(templates ?? []).length > 0 && (
          <div className="field">
            <label>Apply a template (optional)</label>
            <select className="select" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">— None —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        <div className="field">
          <label>Message</label>
          <textarea className="textarea" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your message…" />
          <span className="muted" style={{ fontSize: 12 }}>
            {segInfo.length} chars · {segInfo.segments || 0} segment{segInfo.segments === 1 ? "" : "s"}
          </span>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <Switch on={scheduled} onChange={setScheduled} />
            <span style={{ fontSize: 13.5 }}>Schedule for later</span>
          </div>
          {scheduled && (
            <input
              type="datetime-local"
              className="input"
              style={{ maxWidth: 220 }}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          )}
        </div>

        {missingPhoneCount > 0 && (
          <div className="badge badge-gold" style={{ display: "block", padding: "8px 12px" }}>
            {missingPhoneCount} selected member{missingPhoneCount === 1 ? "" : "s"} have no phone on file and will be skipped.
          </div>
        )}
        {feedback && (
          <div className={"badge " + (feedback.type === "error" ? "badge-red" : "badge-green")} style={{ display: "block", padding: "8px 12px" }}>
            {feedback.text}
          </div>
        )}

        <div className="row between">
          <span className="muted" style={{ fontSize: 13 }}>{selectedMembers.length} recipient{selectedMembers.length === 1 ? "" : "s"} selected</span>
          <button className="btn btn-primary" onClick={onSend} disabled={sendSms.isPending}>
            <Icon name={scheduled ? "clock" : "send"} size={15} />
            {sendSms.isPending ? "Sending…" : scheduled ? "Schedule" : "Send now"}
          </button>
        </div>
      </div>

      <div className="glass card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: 560 }}>
        <div className="search" style={{ maxWidth: "none" }}>
          <Icon name="search" size={15} />
          <input placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="row between">
          <button className="btn btn-ghost" style={{ fontSize: 12.5, height: 30, padding: "0 10px" }} onClick={selectAllVisible}>Select all visible</button>
          <button className="btn btn-ghost" style={{ fontSize: 12.5, height: 30, padding: "0 10px" }} onClick={clearSelection}>Clear</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {candidates.map((m) => (
            <div key={m.id} className="row" style={{ gap: 10, padding: "8px 4px", cursor: "pointer" }} onClick={() => toggle(m)}>
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={selected.has(m.id)} onChange={() => toggle(m)} />
              </div>
              <Avatar initials={initialsOf(m.name)} gold={m.gender === "Female"} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                <div className="faint" style={{ fontSize: 11 }}>{m.contact || "No phone"}</div>
              </div>
            </div>
          ))}
          {candidates.length === 0 && <p className="muted" style={{ fontSize: 13, padding: "10px 4px" }}>No members match.</p>}
        </div>
      </div>
    </div>
  );
}

// ============== Templates ==============

function TemplatesTab({ canManage, onUse }) {
  const { data: templates, isLoading } = useSmsTemplates();
  const deleteTemplate = useDeleteTemplate();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "16px 18px" }}>
        <h3 style={{ fontSize: 16 }}>Message templates</h3>
        {canManage && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} /> New template</button>}
      </div>
      {isLoading && <p className="muted" style={{ padding: "0 18px 18px" }}>Loading…</p>}
      {!isLoading && (templates ?? []).length === 0 && <p className="muted" style={{ padding: "0 18px 18px", fontSize: 13 }}>No templates yet.</p>}
      {(templates ?? []).map((t) => (
        <div key={t.id} className="row between" style={{ padding: "12px 18px", borderTop: "1px solid var(--line-2)" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{t.name}</div>
            <div className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.body}</div>
          </div>
          <div className="row" style={{ gap: 4, flexShrink: 0 }}>
            <button className="btn btn-ghost" style={{ height: 32, fontSize: 12.5 }} onClick={() => onUse(t.body)}>Use</button>
            {canManage && (
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => { if (confirm(`Delete template "${t.name}"?`)) deleteTemplate.mutate(t.id); }}
              >
                <Icon name="trash" size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
      {showAdd && <TemplateFormModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function TemplateFormModal({ onClose }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState(null);
  const createTemplate = useCreateTemplate();

  const onSave = async () => {
    if (!name.trim()) return setError("Name is required.");
    if (!body.trim()) return setError("Message body is required.");
    try {
      await createTemplate.mutateAsync({ name: name.trim(), body: body.trim() });
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this template.");
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 460, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>New template</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field"><label>Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Message</label><textarea className="textarea" rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        </div>
        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={createTemplate.isPending}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ============== Logs ==============

function LogsTab() {
  const { data: batches, isLoading, isError, error } = useSmsBatches();
  const [viewingBatch, setViewingBatch] = useState(null);

  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      {isError && (
        <div className="badge badge-red" style={{ display: "block", margin: 18, padding: "8px 12px" }}>
          Couldn't load logs: {error.message}
        </div>
      )}
      <ScrollX>
        <table className="table">
          <thead>
            <tr><th>Date</th><th>Scope</th><th>Recipients</th><th>Status</th><th>Message</th><th></th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
            {!isLoading && (batches ?? []).length === 0 && (
              <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: "center" }}>No messages sent yet.</td></tr>
            )}
            {(batches ?? []).map((b) => (
              <tr key={b.id} className="row-hover" onClick={() => setViewingBatch(b)}>
                <td className="muted">{new Date(b.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td>{b.ministries?.name ?? "General"}</td>
                <td>{b.recipient_count}</td>
                <td><span className={"badge " + (STATUS_BADGE[b.status] ?? "")}>{SMS_STATUS_LABELS[b.status] ?? b.status}</span></td>
                <td className="muted" style={{ maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.body}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-icon btn-ghost" onClick={() => setViewingBatch(b)}><Icon name="eye" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
      {viewingBatch && <BatchDetailModal batch={viewingBatch} onClose={() => setViewingBatch(null)} />}
    </div>
  );
}

function BatchDetailModal({ batch, onClose }) {
  const { data: messages, isLoading } = useSmsBatchMessages(batch.id);
  return (
    <Modal onClose={onClose}>
      <div className="glass" style={{ width: "100%", maxWidth: 520, padding: 26, maxHeight: "76vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500 }}>{batch.ministries?.name ?? "General"} · {batch.recipient_count} recipients</h2>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{batch.body}</p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {isLoading && <p className="muted">Loading…</p>}
          {(messages ?? []).map((m) => (
            <div key={m.id} className="row between" style={{ padding: "8px 0", borderTop: "1px solid var(--line-2)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5 }}>{m.recipient_name || "—"}</div>
                <div className="faint mono" style={{ fontSize: 11.5 }}>{m.recipient_phone}</div>
              </div>
              <span className={"badge " + (STATUS_BADGE[m.status] ?? "")}>{SMS_STATUS_LABELS[m.status] ?? m.status}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
