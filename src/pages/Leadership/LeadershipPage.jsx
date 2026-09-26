import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { MemberPicker } from "../../components/MemberPicker.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { groupByAssembly } from "../../lib/assembly.js";
import {
  usePresbyters, useMinistryLeadership,
  useCreatePresbyter, useUpdatePresbyter, useDeletePresbyter,
  useCreateMinistryLeader, useUpdateMinistryLeader, useDeleteMinistryLeader,
  friendlyLeadershipError,
} from "../../hooks/useLeadership.js";
import { useMinistries } from "../../hooks/useMinistries.js";

const MEMBER_REQUIRED_MESSAGE = "Please select a member from the church member database.";
const PORTFOLIOS = ["Elder", "Deacon", "Deaconess"];

export function LeadershipPage() {
  const { role } = useAuth();
  const canManage = accessLevel(role, "leadership") === "full";

  const { data: presbyters, isLoading: presbytersLoading } = usePresbyters();
  const { data: leadership, isLoading: leadershipLoading } = useMinistryLeadership();
  const { data: ministries } = useMinistries();
  const [addingPresbyter, setAddingPresbyter] = useState(false);
  const [editingPresbyter, setEditingPresbyter] = useState(null);
  const [addingLeader, setAddingLeader] = useState(false);
  const [editingLeader, setEditingLeader] = useState(null);
  const [presbyterPortfolioFilter, setPresbyterPortfolioFilter] = useState("");
  const [presbyterServiceFilter, setPresbyterServiceFilter] = useState("");
  // A ministry's UUID, not its name — two different ministries (English
  // and Twi assemblies) can share the same name, so the name alone can't
  // identify which one to filter by.
  const [leadershipMinistryFilter, setLeadershipMinistryFilter] = useState("");

  const deletePresbyter = useDeletePresbyter();
  const deleteLeader = useDeleteMinistryLeader();

  // Both lists are fetched wholesale (no server pagination), so filters
  // narrow client-side before grouping — same pattern groupByAssembly
  // itself already uses, just one more pass in front of it. Portfolio and
  // Service filter Presbyters independently (AND when both are set); the
  // Ministry/Department filter is a separate piece of state on its own list.
  const filteredPresbyters = (presbyters ?? []).filter((p) =>
    (!presbyterPortfolioFilter || p.portfolio === presbyterPortfolioFilter)
    && (!presbyterServiceFilter || p.assembly === presbyterServiceFilter)
  );
  const presbyterSections = groupByAssembly(filteredPresbyters);

  const filteredLeadership = leadershipMinistryFilter
    ? (leadership ?? []).filter((l) => l.ministry_id === leadershipMinistryFilter)
    : leadership;
  const leadershipSections = groupByAssembly(filteredLeadership, (l) => l.ministries?.assembly ?? null);
  // Same English/Twi/Departments ordering as the results themselves
  // (groupByAssembly), so a ministry appears under the filter in the same
  // grouping its leadership rows would render under once selected.
  const ministryFilterOptions = groupByAssembly(ministries).flatMap((section) =>
    section.items.map((m) => ({
      value: m.id,
      label: section.key === null ? m.name : `${m.name} — ${section.label}`,
    }))
  );

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Directory</div>
          <h1>Leadership</h1>
          <p>Presbyters and ministry & department leadership, by service.</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="glass card">
          <div className="row between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ fontSize: 16 }}>Presbyters</h3>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <select
                className="select"
                style={{ width: 140, maxWidth: "100%" }}
                value={presbyterPortfolioFilter}
                onChange={(e) => setPresbyterPortfolioFilter(e.target.value)}
              >
                <option value="">All portfolios</option>
                {PORTFOLIOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                className="select"
                style={{ width: 150, maxWidth: "100%" }}
                value={presbyterServiceFilter}
                onChange={(e) => setPresbyterServiceFilter(e.target.value)}
              >
                <option value="">All services</option>
                <option value="English">English Service</option>
                <option value="Twi">Twi Service</option>
              </select>
              {canManage && <button className="btn btn-ghost" onClick={() => setAddingPresbyter(true)}><Icon name="plus" size={14} /> Add</button>}
            </div>
          </div>
          {presbytersLoading && <p className="muted">Loading…</p>}
          {presbyterSections.map((section) => (
            <div key={section.label} style={{ marginBottom: 10 }}>
              <div className="eyebrow" style={{ marginTop: 8 }}>{section.label}</div>
              {section.items.map((p) => {
                const displayName = p.members?.name || p.name;
                const displayContact = p.members?.contact || p.contact;
                return (
                  <div key={p.id} className="row between" style={{ padding: "10px 0", borderTop: "1px solid var(--line-2)" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{displayName}</div>
                      <div className="faint" style={{ fontSize: 11.5 }}>{p.portfolio || "—"}</div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="muted mono" style={{ fontSize: 12.5 }}>{displayContact || "—"}</span>
                      {canManage && (
                        <div className="row" style={{ gap: 2 }}>
                          <button className="btn btn-icon btn-ghost" onClick={() => setEditingPresbyter(p)}><Icon name="edit" size={13} /></button>
                          <button
                            className="btn btn-icon btn-ghost"
                            onClick={() => { if (confirm(`Remove ${displayName} from Presbyters?`)) deletePresbyter.mutate(p.id); }}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {!presbytersLoading && presbyterSections.length === 0 && (
            <p className="muted" style={{ fontSize: 13 }}>
              {(presbyterPortfolioFilter || presbyterServiceFilter) ? "No presbyters match these filters." : "None recorded yet."}
            </p>
          )}
        </div>

        <div className="glass card">
          <div className="row between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ fontSize: 16 }}>Ministry & Department Leadership</h3>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <select
                className="select"
                style={{ width: 220, maxWidth: "100%" }}
                value={leadershipMinistryFilter}
                onChange={(e) => setLeadershipMinistryFilter(e.target.value)}
              >
                <option value="">All ministries and departments</option>
                {ministryFilterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {canManage && <button className="btn btn-ghost" onClick={() => setAddingLeader(true)}><Icon name="plus" size={14} /> Add</button>}
            </div>
          </div>
          {leadershipLoading && <p className="muted">Loading…</p>}
          {leadershipSections.map((section) => (
            <div key={section.label} style={{ marginBottom: 10 }}>
              <div className="eyebrow" style={{ marginTop: 8 }}>{section.label}</div>
              {section.items.map((l) => {
                const displayName = l.members?.name || l.leader_name;
                const displayContact = l.members?.contact || l.contact;
                return (
                  <div key={l.id} className="row between" style={{ padding: "10px 0", borderTop: "1px solid var(--line-2)" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{displayName}</div>
                      <div className="faint" style={{ fontSize: 11.5 }}>{l.ministries?.name} · {l.portfolio}</div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="muted mono" style={{ fontSize: 12.5 }}>{displayContact || "—"}</span>
                      {canManage && (
                        <div className="row" style={{ gap: 2 }}>
                          <button className="btn btn-icon btn-ghost" onClick={() => setEditingLeader(l)}><Icon name="edit" size={13} /></button>
                          <button
                            className="btn btn-icon btn-ghost"
                            onClick={() => { if (confirm(`Remove ${displayName} from ${l.ministries?.name}'s leadership?`)) deleteLeader.mutate(l.id); }}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {!leadershipLoading && leadershipSections.length === 0 && (
            <p className="muted" style={{ fontSize: 13 }}>
              {leadershipMinistryFilter ? "No leadership records for this ministry or department." : "None recorded yet."}
            </p>
          )}
        </div>
      </div>

      {(addingPresbyter || editingPresbyter) && (
        <PresbyterModal presbyter={editingPresbyter} onClose={() => { setAddingPresbyter(false); setEditingPresbyter(null); }} />
      )}
      {(addingLeader || editingLeader) && (
        <MinistryLeaderModal leader={editingLeader} onClose={() => { setAddingLeader(false); setEditingLeader(null); }} />
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 440, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>{title}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        {children}
      </div>
    </Modal>
  );
}

// Handles both create (no `presbyter` prop) and edit. Name/contact are no
// longer free text — both come from whichever member is selected via
// MemberPicker, and member_id is the only thing that actually identifies
// who this presbyter is. A legacy row with no member_id (member_id is
// null, presbyter?.members is undefined) starts with nothing selected, so
// the same "must select before saving" validation below naturally forces
// the admin to link it before the edit can go through. Service is
// English/Twi only — presbyters are never a Departments-wide role, unlike
// ministries themselves.
function PresbyterModal({ presbyter, onClose }) {
  const [memberId, setMemberId] = useState(presbyter?.member_id ?? "");
  const [selectedMember, setSelectedMember] = useState(presbyter?.members ?? null);
  const [portfolio, setPortfolio] = useState(presbyter?.portfolio ?? "Elder");
  const [assembly, setAssembly] = useState(presbyter?.assembly ?? "English");
  const [error, setError] = useState(null);
  const create = useCreatePresbyter();
  const update = useUpdatePresbyter();
  const saving = create.isPending || update.isPending;

  const onSave = async () => {
    if (saving) return;
    if (!memberId || !selectedMember) return setError(MEMBER_REQUIRED_MESSAGE);
    setError(null);
    const payload = {
      member_id: memberId,
      name: selectedMember.name,
      contact: selectedMember.contact || null,
      portfolio,
      assembly,
    };
    try {
      if (presbyter) await update.mutateAsync({ id: presbyter.id, ...payload });
      else await create.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(friendlyLeadershipError(err, { duplicateMessage: "This member is already listed as a presbyter." }));
    }
  };

  return (
    <ModalShell title={presbyter ? "Edit presbyter" : "Add presbyter"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field">
          <label>Member</label>
          <MemberPicker
            value={memberId}
            selectedMember={selectedMember}
            onSelect={(m) => { setMemberId(m.id); setSelectedMember(m); }}
            onChange={() => { setMemberId(""); setSelectedMember(null); }}
            placeholder="Search members by name…"
          />
        </div>
        <div className="field">
          <label>Portfolio</label>
          <select className="select" value={portfolio} onChange={(e) => setPortfolio(e.target.value)}>
            {PORTFOLIOS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Service</label>
          <select className="select" value={assembly} onChange={(e) => setAssembly(e.target.value)}>
            <option value="English">English Service</option>
            <option value="Twi">Twi Service</option>
          </select>
        </div>
      </div>
      {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
      <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>Save</button>
      </div>
    </ModalShell>
  );
}

// Handles both create (no `leader` prop) and edit. Same member-only rule
// as PresbyterModal — leader_name/contact are derived from the selected
// member, never typed.
function MinistryLeaderModal({ leader, onClose }) {
  const { data: ministries } = useMinistries();
  const [ministryId, setMinistryId] = useState(leader?.ministry_id ?? "");
  const [memberId, setMemberId] = useState(leader?.member_id ?? "");
  const [selectedMember, setSelectedMember] = useState(leader?.members ?? null);
  const [portfolio, setPortfolio] = useState(leader?.portfolio ?? "");
  const [error, setError] = useState(null);
  const create = useCreateMinistryLeader();
  const update = useUpdateMinistryLeader();
  const saving = create.isPending || update.isPending;

  const onSave = async () => {
    if (saving) return;
    if (!ministryId) return setError("Ministry or department is required.");
    if (!memberId || !selectedMember) return setError(MEMBER_REQUIRED_MESSAGE);
    if (!portfolio.trim()) return setError("Portfolio is required.");
    setError(null);
    const payload = {
      ministry_id: ministryId,
      member_id: memberId,
      leader_name: selectedMember.name,
      contact: selectedMember.contact || null,
      portfolio: portfolio.trim(),
    };
    try {
      if (leader) await update.mutateAsync({ id: leader.id, ...payload });
      else await create.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(friendlyLeadershipError(err, { duplicateMessage: "This member already holds this portfolio in this ministry or department." }));
    }
  };

  return (
    <ModalShell title={leader ? "Edit ministry leader" : "Add ministry leader"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field">
          <label>Ministry or Department</label>
          <select className="select" value={ministryId} onChange={(e) => setMinistryId(e.target.value)}>
            <option value="">Select a ministry or department…</option>
            {(ministries ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.assembly ? ` (${m.assembly})` : ""}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Member</label>
          <MemberPicker
            value={memberId}
            selectedMember={selectedMember}
            onSelect={(m) => { setMemberId(m.id); setSelectedMember(m); }}
            onChange={() => { setMemberId(""); setSelectedMember(null); }}
            placeholder="Search members by name…"
          />
        </div>
        <div className="field"><label>Portfolio</label><input className="input" placeholder="e.g. President, Coordinator…" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} /></div>
      </div>
      {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
      <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>Save</button>
      </div>
    </ModalShell>
  );
}
