import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { Avatar, Checkbox, Switch } from "../../components/primitives.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import {
  smsSegmentInfo, SMS_STATUS_LABELS, TEMPLATE_VARIABLES, TEMPLATE_CATEGORIES,
  AUTOMATION_TRIGGER_LABELS, applyTemplateVariables, splitName, dedupeRecipientsByPhone,
} from "../../lib/sms.js";
import { useMinistries, useMinistryRoster } from "../../hooks/useMinistries.js";
import { useMembers } from "../../hooks/useMembers.js";
import {
  useSmsTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
  useSmsBatches, useSmsBatchMessages, useSmsBatchDeliverySummary, useSmsBalance, useSmsConfig,
  useSendSms, useScheduledBatches, useCancelScheduledBatch,
} from "../../hooks/useMessages.js";
import {
  useManualContacts, useCreateManualContact, useUpdateManualContact, useDeleteManualContact,
} from "../../hooks/useManualContacts.js";
import {
  useAutomations, useCreateAutomation, useUpdateAutomation, useDeleteAutomation,
} from "../../hooks/useAutomations.js";

const TABS = [
  { key: "send", label: "Send Now" },
  { key: "scheduled", label: "Scheduled" },
  { key: "automation", label: "Automation" },
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

const SMALL_BTN = { fontSize: 12.5, height: 30, padding: "0 10px" };

// Extended from the Phase 4 baseline (Send/Templates/Logs) with Manual
// Contacts, Scheduled and Automation tabs, recipient filtering,
// personalization, and a send-confirmation step. Recipient/role scoping
// here is UX-only, same split as every other module — sms_batches/
// sms_messages/manual_contacts/message_automations RLS (0009 + 0010) is
// the actual authority.
export function MessagesPage() {
  const { role, profile } = useAuth();
  const access = accessLevel(role, "messages"); // "full" | "own" | "send" | "view" (route already blocks null)
  const canSend = access !== "view";
  const canManage = access === "full"; // super_admin / comms_media — templates, manual contacts, automations

  const tabs = TABS.filter((t) => t.key !== "send" || canSend);
  const [tab, setTab] = useState(tabs[0].key);
  const [prefillBody, setPrefillBody] = useState(null);

  const { data: balance, refetch: refetchBalance, isFetching: balanceFetching } = useSmsBalance();
  const { data: config, refetch: refetchConfig } = useSmsConfig();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Messaging</div>
          <h1>Messaging</h1>
          <p>
            Send & schedule SMS messages.{" "}
            {access === "full" && "Compose and send to any ministry or the whole church."}
            {access === "own" && "Compose and send to your own ministry."}
            {access === "send" && "Compose and send general church-wide messages."}
            {access === "view" && "View-only — your role can't send messages."}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {config && (
            <span className="badge badge-blue">
              {config.mode === "live" ? (config.ready ? `Live · ${config.senderId}` : "Provider not configured") : "Mock mode"}
            </span>
          )}
          <div className="badge badge-blue">
            <Icon name="bell" size={12} /> Balance: {balance ? `${balance.currency} ${balance.balance.toFixed(2)}` : "…"}
          </div>
          <button
            className="btn btn-icon btn-ghost"
            title="Refresh balance"
            disabled={balanceFetching}
            onClick={() => { refetchBalance(); refetchConfig(); }}
          >
            <Icon name="refresh" size={14} />
          </button>
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
          config={config}
          prefillBody={prefillBody}
          onConsumePrefill={() => setPrefillBody(null)}
        />
      )}
      {tab === "scheduled" && <ScheduledTab canManage={canSend} />}
      {tab === "automation" && <AutomationTab canManage={canManage} />}
      {tab === "templates" && (
        <TemplatesTab canManage={canManage} onUse={(body) => { setPrefillBody(body); setTab("send"); }} />
      )}
      {tab === "logs" && <LogsTab />}
    </div>
  );
}

// ============== Send ==============

function SendTab({ role, profile, access, config, prefillBody, onConsumePrefill }) {
  const isMinistryLeader = role === "ministry_leader";
  const isSecretary = role === "secretary";
  const canPickScope = access === "full"; // super_admin / comms_media
  const canManageContacts = access === "full";

  const [recipientMode, setRecipientMode] = useState("members"); // 'members' | 'manual' | 'combined'
  const showMembers = recipientMode === "members" || recipientMode === "combined";
  const showManual = recipientMode === "manual" || recipientMode === "combined";

  const { data: ministries } = useMinistries();
  const [scopeMinistryId, setScopeMinistryId] = useState(""); // "" = General
  const effectiveMinistryId = isMinistryLeader
    ? (profile?.ministry_id ?? null)
    : (isSecretary ? null : (scopeMinistryId || null));
  const scopeMinistryName = ministries?.find((m) => m.id === effectiveMinistryId)?.name ?? "";

  const [q, setQ] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const { data: ministryRoster } = useMinistryRoster(effectiveMinistryId);
  const { data: generalMembers } = useMembers({ page: 0, pageSize: 50, search: q, gender: genderFilter, residence: locationFilter });
  const { data: manualContacts } = useManualContacts({ search: q });

  const candidates = effectiveMinistryId
    ? (ministryRoster ?? []).map((r) => r.members).filter((m) =>
        m &&
        (!q || m.name.toLowerCase().includes(q.toLowerCase())) &&
        (!genderFilter || m.gender === genderFilter) &&
        (!locationFilter || (m.residence ?? "").toLowerCase().includes(locationFilter.toLowerCase()))
      )
    : (generalMembers?.rows ?? []);
  const manualCandidates = manualContacts ?? [];

  // Keyed by id -> record, not derived by filtering `candidates` — that
  // would silently drop previously-selected recipients from the count the
  // moment a new search/filter narrows the visible list.
  const [selectedMembers, setSelectedMembers] = useState(new Map());
  const [selectedManual, setSelectedManual] = useState(new Map());
  useEffect(() => { setSelectedMembers(new Map()); }, [effectiveMinistryId]);

  const toggleMember = (member) => setSelectedMembers((prev) => {
    const next = new Map(prev);
    if (next.has(member.id)) next.delete(member.id); else next.set(member.id, member);
    return next;
  });
  const toggleManual = (contact) => setSelectedManual((prev) => {
    const next = new Map(prev);
    if (next.has(contact.id)) next.delete(contact.id); else next.set(contact.id, contact);
    return next;
  });
  const selectAllVisible = () => {
    if (showMembers) setSelectedMembers((prev) => { const next = new Map(prev); candidates.forEach((m) => next.set(m.id, m)); return next; });
    if (showManual) setSelectedManual((prev) => { const next = new Map(prev); manualCandidates.forEach((c) => next.set(c.id, c)); return next; });
  };
  const clearSelection = () => { setSelectedMembers(new Map()); setSelectedManual(new Map()); };

  const rawRecipients = [
    ...Array.from(selectedMembers.values()).map((m) => ({ memberId: m.id, name: m.name, phone: m.contact, ministry: scopeMinistryName, isManual: false })),
    ...Array.from(selectedManual.values()).map((c) => ({ memberId: null, name: c.full_name, phone: c.phone, ministry: "", isManual: true })),
  ];
  const withPhone = rawRecipients.filter((r) => r.phone);
  const missingPhoneCount = rawRecipients.length - withPhone.length;
  const { recipients: dedupedRecipients, duplicatesRemoved } = dedupeRecipientsByPhone(withPhone);

  const { data: templates } = useSmsTemplates();
  const [categoryFilter, setCategoryFilter] = useState("");
  const filteredTemplates = (templates ?? []).filter((t) => !categoryFilter || t.category === categoryFilter);
  const [templateId, setTemplateId] = useState("");
  const [body, setBody] = useState("");
  const textareaRef = useRef(null);
  useEffect(() => {
    if (prefillBody != null) {
      setBody(prefillBody);
      onConsumePrefill();
    }
  }, [prefillBody, onConsumePrefill]);

  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const sendSms = useSendSms();
  const deleteContact = useDeleteManualContact();
  const segInfo = smsSegmentInfo(body);
  const hasVariables = /\{\{\w+\}\}/.test(body);

  const applyTemplate = (id) => {
    setTemplateId(id);
    const t = (templates ?? []).find((t) => t.id === id);
    if (t) setBody(t.body);
  };

  const insertVariable = (token) => {
    const el = textareaRef.current;
    if (!el) { setBody((b) => b + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const previewRecipient = dedupedRecipients[0];
  const previewText = previewRecipient
    ? applyTemplateVariables(body, { ...splitName(previewRecipient.name), fullName: previewRecipient.name, phone: previewRecipient.phone, ministry: previewRecipient.ministry })
    : body;

  const openConfirm = () => {
    setFeedback(null);
    if (!body.trim()) return setFeedback({ type: "error", text: "Message body can't be empty." });
    if (dedupedRecipients.length === 0) {
      return setFeedback({
        type: "error",
        text: missingPhoneCount > 0 && rawRecipients.length > 0
          ? "None of the selected recipients have a phone number on file."
          : "Select at least one recipient.",
      });
    }
    if (scheduled && !scheduledAt) return setFeedback({ type: "error", text: "Pick a date and time to schedule for." });
    setShowConfirm(true);
  };

  const doSend = async () => {
    setShowConfirm(false);
    try {
      const result = await sendSms.mutateAsync({
        body,
        recipients: dedupedRecipients,
        ministryId: effectiveMinistryId,
        templateId: templateId || null,
        scheduledAt: scheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        personalize: hasVariables,
      });
      if (result.scheduled) {
        setFeedback({ type: "success", text: `Scheduled for ${dedupedRecipients.length} recipient${dedupedRecipients.length === 1 ? "" : "s"}.` });
      } else {
        const { sentCount, failedCount } = result.sendResult ?? {};
        setFeedback({
          type: failedCount ? "error" : "success",
          text: `Sent ${sentCount ?? dedupedRecipients.length}${failedCount ? `, ${failedCount} failed` : ""}.`,
        });
      }
      clearSelection();
      setBody("");
      setTemplateId("");
      setScheduled(false);
      setScheduledAt("");
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Couldn't send." });
    }
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {/* ---------- Recipients ---------- */}
      <div className="glass card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: 640 }}>
        <div className="row between">
          <h3 style={{ fontSize: 15 }}>Select recipients</h3>
          {canManageContacts && (
            <button className="btn btn-ghost" style={SMALL_BTN} onClick={() => { setEditingContact(null); setShowAddContact(true); }}>
              <Icon name="plus" size={13} /> Add Contact
            </button>
          )}
        </div>

        <select className="select" value={recipientMode} onChange={(e) => setRecipientMode(e.target.value)}>
          <option value="members">Members</option>
          <option value="manual">Manual Contacts</option>
          <option value="combined">Combined (Members + Manual)</option>
        </select>

        {showMembers && canPickScope && (
          <select className="select" value={scopeMinistryId} onChange={(e) => setScopeMinistryId(e.target.value)}>
            <option value="">General (search all members)</option>
            {(ministries ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.assembly ? ` (${m.assembly})` : ""}</option>
            ))}
          </select>
        )}
        {showMembers && isMinistryLeader && (
          <div className="badge badge-blue" style={{ alignSelf: "flex-start" }}>
            Sending to: {ministries?.find((m) => m.id === profile?.ministry_id)?.name ?? "your ministry"}
          </div>
        )}
        {showMembers && isSecretary && (
          <div className="badge badge-blue" style={{ alignSelf: "flex-start" }}>Sending to: General (all members)</div>
        )}

        {/* No per-instance size override — uses the shared .search class
            exactly as-is, identical to Members' search box, so there's
            nothing instance-specific left to drift out of sync. */}
        <div className="search" style={{ maxWidth: "none" }}>
          <Icon name="search" size={16} />
          <input placeholder="Search members & contacts…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {showMembers && (
          <div className="row" style={{ gap: 8 }}>
            <select className="select" style={{ flex: 1 }} value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
              <option value="">All genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <input className="input" style={{ flex: 1 }} placeholder="Location…" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} />
          </div>
        )}

        <div className="row between">
          <button className="btn btn-ghost" style={SMALL_BTN} onClick={selectAllVisible}>Select all visible</button>
          <button className="btn btn-ghost" style={SMALL_BTN} onClick={clearSelection}>Clear</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {showManual && (
            <>
              <div className="nav-section" style={{ padding: "4px 4px" }}>Manual Contacts</div>
              {manualCandidates.map((c) => (
                <ManualContactRow
                  key={c.id}
                  contact={c}
                  checked={selectedManual.has(c.id)}
                  onToggle={() => toggleManual(c)}
                  canManage={canManageContacts}
                  onEdit={() => { setEditingContact(c); setShowAddContact(true); }}
                  onDelete={() => { if (confirm(`Delete contact "${c.full_name}"?`)) deleteContact.mutate(c.id); }}
                />
              ))}
              {manualCandidates.length === 0 && (
                <div className="muted" style={{ fontSize: 12.5, padding: "8px 4px 4px" }}>
                  No manual contacts yet. Add contacts who aren't in the member directory.
                </div>
              )}
            </>
          )}
          {showMembers && (
            <>
              {showManual && <div className="nav-section" style={{ padding: "10px 4px 4px" }}>Members</div>}
              {candidates.map((m) => (
                <div key={m.id} className="row" style={{ gap: 10, padding: "8px 4px", cursor: "pointer" }} onClick={() => toggleMember(m)}>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedMembers.has(m.id)} onChange={() => toggleMember(m)} />
                  </div>
                  <Avatar initials={initialsOf(m.name)} gold={m.gender === "Female"} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                    <div className="faint" style={{ fontSize: 11 }}>{m.contact || "No phone"}</div>
                  </div>
                </div>
              ))}
              {candidates.length === 0 && <p className="muted" style={{ fontSize: 13, padding: "10px 4px" }}>No members match.</p>}
            </>
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 8 }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {selectedMembers.size === 0 && selectedManual.size === 0 && "0 recipients selected"}
            {selectedMembers.size > 0 && `${selectedMembers.size} member${selectedMembers.size === 1 ? "" : "s"}`}
            {selectedMembers.size > 0 && selectedManual.size > 0 && " + "}
            {selectedManual.size > 0 && `${selectedManual.size} manual`}
            {(selectedMembers.size > 0 || selectedManual.size > 0) && ` = ${dedupedRecipients.length} recipient${dedupedRecipients.length === 1 ? "" : "s"}`}
          </span>
          {duplicatesRemoved > 0 && (
            <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>
              {duplicatesRemoved} duplicate phone number{duplicatesRemoved === 1 ? "" : "s"} merged.
            </div>
          )}
        </div>
      </div>

      {/* ---------- Compose ---------- */}
      <div className="glass card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label>Sender ID</label>
          <div className="input row between" style={{ background: "var(--bg-2)" }}>
            <span>{config ? (config.senderId ?? "—") : "…"}</span>
            {config && !config.ready && <span className="badge badge-red" style={{ fontSize: 10 }}>Not configured</span>}
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <select className="select" style={{ flex: 1 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {TEMPLATE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select className="select" style={{ flex: 1 }} value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— No template —</option>
            {filteredTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {TEMPLATE_VARIABLES.map((v) => (
            <button key={v.token} type="button" className="btn btn-ghost" style={{ fontSize: 11.5, height: 26, padding: "0 8px" }} onClick={() => insertVariable(v.token)}>
              {v.label}
            </button>
          ))}
        </div>

        <div className="field">
          <label>Message</label>
          <textarea
            ref={textareaRef}
            className="textarea"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message… use {{first_name}} to personalize"
          />
          <span className="muted" style={{ fontSize: 12 }}>
            {segInfo.length} chars · {segInfo.segments || 0} segment{segInfo.segments === 1 ? "" : "s"}
          </span>
        </div>

        {body.trim() && (
          <div className="glass-soft" style={{ padding: 12 }}>
            <div className="eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>
              SMS Preview{previewRecipient ? ` — ${previewRecipient.name}` : ""}
            </div>
            {config?.senderId && <div className="muted mono" style={{ fontSize: 11 }}>{config.senderId}</div>}
            <p style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap" }}>{previewText}</p>
          </div>
        )}

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
            {missingPhoneCount} selected recipient{missingPhoneCount === 1 ? "" : "s"} have no phone on file and will be skipped.
          </div>
        )}
        {feedback && (
          <div className={"badge " + (feedback.type === "error" ? "badge-red" : "badge-green")} style={{ display: "block", padding: "8px 12px" }}>
            {feedback.text}
          </div>
        )}

        <div className="row between">
          <span className="muted" style={{ fontSize: 13 }}>{dedupedRecipients.length} recipient{dedupedRecipients.length === 1 ? "" : "s"} selected</span>
          <button className="btn btn-primary" onClick={openConfirm} disabled={sendSms.isPending}>
            <Icon name={scheduled ? "clock" : "send"} size={15} />
            Review & {scheduled ? "Schedule" : "Send"}
          </button>
        </div>
      </div>

      {showAddContact && (
        <ManualContactFormModal contact={editingContact} onClose={() => setShowAddContact(false)} />
      )}
      {showConfirm && (
        <ConfirmSendModal
          recipientCount={dedupedRecipients.length}
          segInfo={segInfo}
          previewText={previewText}
          scheduled={scheduled}
          scheduledAt={scheduledAt}
          onCancel={() => setShowConfirm(false)}
          onConfirm={doSend}
          sending={sendSms.isPending}
        />
      )}
    </div>
  );
}

function ManualContactRow({ contact, checked, onToggle, canManage, onEdit, onDelete }) {
  return (
    <div className="row" style={{ gap: 10, padding: "8px 4px", cursor: "pointer" }} onClick={onToggle}>
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={checked} onChange={onToggle} />
      </div>
      <Avatar initials={initialsOf(contact.full_name)} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contact.full_name}</span>
          <span className="badge badge-gold" style={{ fontSize: 9, padding: "1px 6px" }}>Manual</span>
        </div>
        <div className="faint" style={{ fontSize: 11 }}>{contact.phone}</div>
      </div>
      {canManage && (
        <div className="row" style={{ gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-icon btn-ghost" style={{ width: 26, height: 26 }} onClick={onEdit}><Icon name="edit" size={12} /></button>
          <button className="btn btn-icon btn-ghost" style={{ width: 26, height: 26 }} onClick={onDelete}><Icon name="trash" size={12} /></button>
        </div>
      )}
    </div>
  );
}

function ManualContactFormModal({ contact, onClose }) {
  const [fullName, setFullName] = useState(contact?.full_name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [groupLabel, setGroupLabel] = useState(contact?.group_label ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [error, setError] = useState(null);
  const createContact = useCreateManualContact();
  const updateContact = useUpdateManualContact();
  const saving = createContact.isPending || updateContact.isPending;

  const onSave = async () => {
    if (!fullName.trim()) return setError("Full name is required.");
    if (!phone.trim()) return setError("Phone number is required.");
    try {
      if (contact) {
        await updateContact.mutateAsync({ id: contact.id, fullName: fullName.trim(), phone, email: email.trim(), groupLabel: groupLabel.trim(), notes: notes.trim() });
      } else {
        await createContact.mutateAsync({ fullName: fullName.trim(), phone, email: email.trim(), groupLabel: groupLabel.trim(), notes: notes.trim() });
      }
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this contact.");
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 460, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>{contact ? "Edit contact" : "Add manual contact"}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field"><label>Full name</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="field"><label>Phone number</label><input className="input" placeholder="024XXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="field"><label>Email (optional)</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label>Group / label (optional)</label><input className="input" value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} /></div>
          <div className="field"><label>Notes (optional)</label><textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>Save Contact</button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmSendModal({ recipientCount, segInfo, previewText, scheduled, scheduledAt, onCancel, onConfirm, sending }) {
  return (
    <Modal onClose={onCancel}>
      <div className="glass modal-card" style={{ maxWidth: 440, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, marginBottom: 14 }}>Confirm SMS</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5 }}>
          <div className="row between"><span className="muted">Recipients</span><span style={{ fontWeight: 600 }}>{recipientCount}</span></div>
          <div className="row between"><span className="muted">SMS segments</span><span style={{ fontWeight: 600 }}>{segInfo.segments}</span></div>
          <div className="row between"><span className="muted">Estimated messages</span><span style={{ fontWeight: 600 }}>{recipientCount * Math.max(1, segInfo.segments)}</span></div>
          {scheduled && (
            <div className="row between">
              <span className="muted">Scheduled for</span>
              <span style={{ fontWeight: 600 }}>{scheduledAt ? new Date(scheduledAt).toLocaleString() : "—"}</span>
            </div>
          )}
        </div>
        <div className="glass-soft" style={{ padding: 12, marginTop: 14 }}>
          <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Message</div>
          <p style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{previewText}</p>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={sending}>
            {sending ? "Sending…" : scheduled ? "Confirm & Schedule" : "Confirm & Send"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============== Scheduled ==============

function ScheduledTab({ canManage }) {
  const { data: batches, isLoading, isError, error } = useScheduledBatches();
  const cancelBatch = useCancelScheduledBatch();

  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      {isError && (
        <div className="badge badge-red" style={{ display: "block", margin: 18, padding: "8px 12px" }}>
          Couldn't load scheduled messages: {error.message}
        </div>
      )}
      <ScrollX>
        <table className="table">
          <thead><tr><th>Scheduled for</th><th>Scope</th><th>Recipients</th><th>Message</th><th></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
            {!isLoading && (batches ?? []).length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: "center" }}>No scheduled messages.</td></tr>
            )}
            {(batches ?? []).map((b) => (
              <tr key={b.id}>
                <td>{new Date(b.scheduled_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td>{b.ministries?.name ?? "General"}</td>
                <td>{b.recipient_count}</td>
                <td className="muted" style={{ maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.body}</td>
                <td>
                  {canManage && (
                    <button
                      className="btn btn-ghost"
                      style={SMALL_BTN}
                      onClick={() => { if (confirm("Cancel this scheduled message?")) cancelBatch.mutate(b.id); }}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
    </div>
  );
}

// ============== Automation ==============

function AutomationTab({ canManage }) {
  const { data: automations, isLoading } = useAutomations();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "16px 18px", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 16 }}>Automations</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            Configured here — actually dispatching them on a schedule still needs a scheduled job wired up server-side.
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Icon name="plus" size={15} /> New automation
          </button>
        )}
      </div>
      {isLoading && <p className="muted" style={{ padding: "0 18px 18px" }}>Loading…</p>}
      {!isLoading && (automations ?? []).length === 0 && (
        <p className="muted" style={{ padding: "0 18px 18px", fontSize: 13 }}>No automations created yet.</p>
      )}
      {(automations ?? []).map((a) => (
        <div key={a.id} className="row between" style={{ padding: "12px 18px", borderTop: "1px solid var(--line-2)" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{a.name}</span>
              <span className={"badge " + (a.status === "active" ? "badge-green" : "")}>{a.status === "active" ? "Active" : "Paused"}</span>
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
              {AUTOMATION_TRIGGER_LABELS[a.trigger_type] ?? a.trigger_type} · {a.sms_templates?.name ?? "No template"} · {a.ministries?.name ?? "General"}
            </div>
          </div>
          {canManage && (
            <div className="row" style={{ gap: 8, flexShrink: 0 }}>
              <Switch on={a.status === "active"} onChange={() => updateAutomation.mutate({ id: a.id, status: a.status === "active" ? "paused" : "active" })} />
              <button className="btn btn-icon btn-ghost" onClick={() => { setEditing(a); setShowForm(true); }}><Icon name="edit" size={14} /></button>
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => { if (confirm(`Delete automation "${a.name}"?`)) deleteAutomation.mutate(a.id); }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          )}
        </div>
      ))}
      {showForm && <AutomationFormModal automation={editing} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function AutomationFormModal({ automation, onClose }) {
  const [name, setName] = useState(automation?.name ?? "");
  const [triggerType, setTriggerType] = useState(automation?.trigger_type ?? "birthday");
  const [daysBefore, setDaysBefore] = useState(automation?.trigger_config?.days_before ?? 1);
  const [templateId, setTemplateId] = useState(automation?.template_id ?? "");
  const [ministryId, setMinistryId] = useState(automation?.ministry_id ?? "");
  const [error, setError] = useState(null);
  const { data: templates } = useSmsTemplates();
  const { data: ministries } = useMinistries();
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const saving = createAutomation.isPending || updateAutomation.isPending;

  const onSave = async () => {
    if (!name.trim()) return setError("Name is required.");
    const triggerConfig = triggerType === "event_reminder" ? { days_before: Number(daysBefore) || 1 } : {};
    try {
      if (automation) {
        await updateAutomation.mutateAsync({
          id: automation.id, name: name.trim(), trigger_type: triggerType, trigger_config: triggerConfig,
          template_id: templateId || null, ministry_id: ministryId || null,
        });
      } else {
        await createAutomation.mutateAsync({ name: name.trim(), triggerType, triggerConfig, templateId: templateId || null, ministryId: ministryId || null });
      }
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this automation.");
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 460, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>{automation ? "Edit automation" : "New automation"}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field"><label>Automation name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field">
            <label>Trigger</label>
            <select className="select" value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
              {Object.entries(AUTOMATION_TRIGGER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {triggerType === "event_reminder" && (
            <div className="field"><label>Days before event</label><input type="number" min="0" className="input" value={daysBefore} onChange={(e) => setDaysBefore(e.target.value)} /></div>
          )}
          <div className="field">
            <label>Message template</label>
            <select className="select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">— None —</option>
              {(templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Recipients</label>
            <select className="select" value={ministryId} onChange={(e) => setMinistryId(e.target.value)}>
              <option value="">General (all members)</option>
              {(ministries ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
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

// ============== Templates ==============

function TemplatesTab({ canManage, onUse }) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const { data: templates, isLoading } = useSmsTemplates();
  const deleteTemplate = useDeleteTemplate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = (templates ?? []).filter((t) => !categoryFilter || t.category === categoryFilter);

  return (
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "16px 18px", flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ fontSize: 16 }}>Message templates</h3>
        <div className="row" style={{ gap: 8 }}>
          <select className="select" style={{ height: 36 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {TEMPLATE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {canManage && (
            <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
              <Icon name="plus" size={15} /> New template
            </button>
          )}
        </div>
      </div>
      {isLoading && <p className="muted" style={{ padding: "0 18px 18px" }}>Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="muted" style={{ padding: "0 18px 18px", fontSize: 13 }}>
          {templates?.length ? "No templates in this category." : "No templates created yet."}
        </p>
      )}
      {filtered.map((t) => (
        <div key={t.id} className="row between" style={{ padding: "12px 18px", borderTop: "1px solid var(--line-2)" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{t.name}</span>
              {t.category && <span className="badge badge-blue" style={{ fontSize: 10 }}>{TEMPLATE_CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}</span>}
            </div>
            <div className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.body}</div>
          </div>
          <div className="row" style={{ gap: 4, flexShrink: 0 }}>
            <button className="btn btn-ghost" style={{ height: 32, fontSize: 12.5 }} onClick={() => onUse(t.body)}>Use</button>
            {canManage && (
              <>
                <button className="btn btn-icon btn-ghost" onClick={() => { setEditing(t); setShowForm(true); }}><Icon name="edit" size={14} /></button>
                <button
                  className="btn btn-icon btn-ghost"
                  onClick={() => { if (confirm(`Delete template "${t.name}"?`)) deleteTemplate.mutate(t.id); }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {showForm && <TemplateFormModal template={editing} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function TemplateFormModal({ template, onClose }) {
  const [name, setName] = useState(template?.name ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [category, setCategory] = useState(template?.category ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [error, setError] = useState(null);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const saving = createTemplate.isPending || updateTemplate.isPending;

  const onSave = async () => {
    if (!name.trim()) return setError("Name is required.");
    if (!body.trim()) return setError("Message body is required.");
    try {
      if (template) {
        await updateTemplate.mutateAsync({ id: template.id, name: name.trim(), body: body.trim(), category: category || null, description: description.trim() || null });
      } else {
        await createTemplate.mutateAsync({ name: name.trim(), body: body.trim(), category: category || null, description: description.trim() || null });
      }
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this template.");
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 460, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>{template ? "Edit template" : "New template"}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field"><label>Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field">
            <label>Category (optional)</label>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— Uncategorized —</option>
              {TEMPLATE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="field"><label>Description (optional)</label><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="field"><label>Message</label><textarea className="textarea" rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
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
              <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: "center" }}>No messages have been sent yet.</td></tr>
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
  const { data: summary } = useSmsBatchDeliverySummary(batch.id);
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
        {summary && (
          <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span className="badge badge-green">Sent: {summary.sent}</span>
            <span className="badge badge-blue">Delivered: {summary.delivered}</span>
            <span className="badge badge-red">Failed: {summary.failed}</span>
            {summary.queued > 0 && <span className="badge badge-gold">Pending: {summary.queued}</span>}
          </div>
        )}
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
