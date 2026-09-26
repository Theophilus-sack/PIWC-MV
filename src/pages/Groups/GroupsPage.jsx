import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { Avatar, Checkbox } from "../../components/primitives.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { canManageGroupRoster } from "../../lib/rbac.js";
import {
  useMinistries, useCreateMinistry, useUpdateMinistry, useDeleteMinistry,
  useMinistryRoster, useAddMinistryMember, useRemoveMinistryMember,
  useMinistryActivities, useCreateMinistryActivity, useDeleteMinistryActivity,
} from "../../hooks/useMinistries.js";
import { useMembers } from "../../hooks/useMembers.js";
import { ASSEMBLY_SECTIONS, groupByAssembly } from "../../lib/assembly.js";

const matchesSearch = (haystackParts, query) => {
  if (!query) return true;
  const hay = haystackParts.filter(Boolean).join(" ").toLowerCase();
  return hay.includes(query.toLowerCase());
};

export function GroupsPage() {
  const { role, profile } = useAuth();
  const { data: ministries, isLoading } = useMinistries();
  const isMinistryLeader = role === "ministry_leader";
  const canCreateMinistry = role === "super_admin";
  const [selected, setSelected] = useState(null);
  const [showAddMinistry, setShowAddMinistry] = useState(false);

  const activeMinistryId = isMinistryLeader ? profile?.ministry_id : selected;
  const sections = groupByAssembly(ministries);
  // A leader with no ministry_id must never fall back to browsing
  // everything — that's the one case the selector-hiding above doesn't
  // cover by itself (there's simply no ministry to force-select).
  const leaderUnassigned = isMinistryLeader && !profile?.ministry_id;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Ministries</div>
          <h1>Departments/Ministries</h1>
          <p>{isMinistryLeader ? "View your ministry's roster." : "Browse ministries and their rosters, by service."}</p>
        </div>
        {canCreateMinistry && (
          <button className="btn btn-primary" onClick={() => setShowAddMinistry(true)}><Icon name="plus" size={15} /> Add ministry</button>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: isMinistryLeader ? "1fr" : "300px 1fr", gap: 14 }}>
        {!isMinistryLeader && (
          <div className="glass card" style={{ padding: 10 }}>
            {isLoading && <p className="muted" style={{ padding: 10 }}>Loading…</p>}
            {sections.map((section) => (
              <div key={section.label} style={{ marginBottom: 6 }}>
                <div className="nav-section">{section.label}</div>
                {section.items.map((m) => (
                  <div
                    key={m.id}
                    className={"nav-item" + (m.id === selected ? " active" : "")}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(m.id)}
                  >
                    <span style={{ fontWeight: m.id === selected ? 600 : 400 }}>{m.name}</span>
                  </div>
                ))}
              </div>
            ))}
            {!isLoading && sections.length === 0 && <p className="muted" style={{ padding: 10, fontSize: 13 }}>No ministries yet.</p>}
          </div>
        )}

        {leaderUnassigned ? (
          <div className="glass card" style={{ padding: 40, textAlign: "center" }}>
            <p className="muted">No ministry or department has been assigned to your account. Please contact an administrator.</p>
          </div>
        ) : activeMinistryId ? (
          <Roster
            ministry={ministries?.find((m) => m.id === activeMinistryId)}
            role={role}
            onDeleted={() => setSelected(null)}
          />
        ) : (
          <div className="glass card" style={{ padding: 40, textAlign: "center" }}>
            <p className="muted">Pick a ministry to see its roster.</p>
          </div>
        )}
      </div>

      {showAddMinistry && <MinistryFormModal onClose={() => setShowAddMinistry(false)} />}
    </div>
  );
}

function AssemblyBadge({ assembly }) {
  if (!assembly) return null;
  const section = ASSEMBLY_SECTIONS.find((s) => s.key === assembly);
  return <span className={"badge " + (section?.badgeClass ?? "")}>{section?.label ?? assembly}</span>;
}

function Roster({ ministry, role, onDeleted }) {
  const navigate = useNavigate();
  // "own" (Ministry Leader, scoped to their assigned ministry) is
  // view-only — it must NOT imply create/update/delete. Only "full"
  // unlocks management controls here; the matching RLS restriction lives
  // in migration 0021 (ministry_members_write/ministry_activities_write
  // are Super Admin only now). See rbac.js's canManageGroupRoster for the
  // unit-tested rule this mirrors.
  const canManage = canManageGroupRoster(role);
  const canEditMinistry = role === "super_admin"; // matches ministries_write RLS
  const { data: roster, isLoading, isError, error } = useMinistryRoster(ministry?.id);
  const addMember = useAddMinistryMember();
  const removeMember = useRemoveMinistryMember();
  const deleteMinistry = useDeleteMinistry();
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [search, setSearch] = useState("");

  if (!ministry) return null;

  const onDelete = () => {
    if (!confirm(`Delete "${ministry.name}"? Its roster and leadership entries go with it — this can't be undone.`)) return;
    deleteMinistry.mutate(ministry.id, { onSuccess: onDeleted });
  };

  const rows = roster ?? [];
  const filtered = rows.filter((r) =>
    matchesSearch([r.members?.name, r.members?.member_id, r.members?.contact, r.members?.residence, r.members?.status], search)
  );
  const columnCount = canManage ? 7 : 6;

  return (
    <>
    <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "16px 18px 14px", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="eyebrow row" style={{ gap: 8 }}>Roster <AssemblyBadge assembly={ministry.assembly} /></div>
          <h3 style={{ fontSize: 18, marginTop: 4 }}>{ministry.name} · {rows.length} member{rows.length === 1 ? "" : "s"}</h3>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {canEditMinistry && (
            <>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowEdit(true)}><Icon name="edit" size={14} /></button>
              <button className="btn btn-icon btn-ghost" onClick={onDelete}><Icon name="trash" size={14} /></button>
            </>
          )}
          {canManage && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} /> Add member</button>}
        </div>
      </div>

      {rows.length > 0 && (
        <div style={{ padding: "0 18px 14px" }}>
          <div className="search" style={{ maxWidth: 380 }}>
            <Icon name="search" size={15} />
            <input placeholder="Search name, ID, contact, residence or status…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="btn btn-icon btn-ghost" onClick={() => setSearch("")}><Icon name="x" size={14} /></button>}
          </div>
        </div>
      )}

      {isError && (
        <div className="badge badge-red" style={{ display: "block", margin: "0 18px 14px", padding: "8px 12px" }}>
          Couldn't load this roster: {error.message}
        </div>
      )}
      {isLoading && <p className="muted" style={{ padding: "0 18px 18px" }}>Loading…</p>}
      {!isLoading && !isError && rows.length === 0 && (
        <p className="muted" style={{ padding: "0 18px 18px", fontSize: 13 }}>No members in this ministry or department yet.</p>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <ScrollX>
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Member ID</th>
                <th>Gender</th>
                <th>Contact</th>
                <th>Residence</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={columnCount} className="muted" style={{ padding: 20, textAlign: "center" }}>No members match this search.</td></tr>
              )}
              {filtered.map((r) => {
                const m = r.members;
                return (
                  <tr key={r.id} className="row-hover" onClick={() => m?.id && navigate(`/members/${m.id}`)}>
                    <td>
                      <div className="row" style={{ gap: 12 }}>
                        <Avatar initials={initialsOf(m?.name)} gold={m?.gender === "Female"} size={32} />
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{m?.name || "—"}</span>
                      </div>
                    </td>
                    <td className="mono muted" style={{ fontSize: 12 }}>{m?.member_id || "—"}</td>
                    <td><span className="badge">{m?.gender || "—"}</span></td>
                    <td className="mono muted" style={{ fontSize: 12.5 }}>{m?.contact || "—"}</td>
                    <td className="muted">{m?.residence || "—"}</td>
                    <td><span className={"badge" + (m?.status === "first-timer" ? " badge-gold" : "")}>{m?.status || "—"}</span></td>
                    {canManage && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-icon btn-ghost" onClick={() => removeMember.mutate({ id: r.id, ministryId: ministry.id })}>
                          <Icon name="x" size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollX>
      )}

      {showEdit && <MinistryFormModal ministry={ministry} onClose={() => setShowEdit(false)} />}
      {showAdd && (
        <AddToRosterModal
          ministryId={ministry.id}
          existingIds={rows.map((r) => r.member_id)}
          onAdd={(memberId) => addMember.mutate({ ministryId: ministry.id, memberId })}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
    <MinistryActivityLog ministryId={ministry.id} canManage={canManage} />
    </>
  );
}

function MinistryActivityLog({ ministryId, canManage }) {
  const { data: activities, isLoading } = useMinistryActivities(ministryId);
  const createActivity = useCreateMinistryActivity();
  const deleteActivity = useDeleteMinistryActivity();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="glass card" style={{ marginTop: 14 }}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 16 }}>Activity log</h3>
        {canManage && <button className="btn btn-ghost" style={{ fontSize: 12.5, height: 32 }} onClick={() => setShowAdd(true)}><Icon name="plus" size={13} /> Log activity</button>}
      </div>
      {isLoading && <p className="muted" style={{ fontSize: 13 }}>Loading…</p>}
      {!isLoading && (activities ?? []).length === 0 && <p className="muted" style={{ fontSize: 13 }}>No activities logged yet.</p>}
      {(activities ?? []).map((a) => (
        <div key={a.id} className="row between" style={{ padding: "10px 0", borderTop: "1px solid var(--line-2)" }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{a.activity}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {new Date(a.activity_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              {a.attendance != null && ` · ${a.attendance} attended`}
              {a.pastor_visited && " · Pastor visited"}
            </div>
          </div>
          {canManage && (
            <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("Delete this activity?")) deleteActivity.mutate({ id: a.id, ministryId }); }}>
              <Icon name="trash" size={13} />
            </button>
          )}
        </div>
      ))}
      {showAdd && (
        <MinistryActivityFormModal
          onSave={(row) => createActivity.mutateAsync({ ...row, ministry_id: ministryId })}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function MinistryActivityFormModal({ onSave, onClose }) {
  const [activity, setActivity] = useState("");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [speaker, setSpeaker] = useState("");
  const [attendance, setAttendance] = useState("");
  const [offering, setOffering] = useState("");
  const [pastorVisited, setPastorVisited] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    if (!activity.trim()) return setError("Activity is required.");
    setSaving(true);
    try {
      await onSave({
        activity: activity.trim(), activity_date: activityDate, speaker_facilitator: speaker || null,
        attendance: attendance === "" ? null : Number(attendance),
        offering_ghs: offering === "" ? null : Number(offering),
        pastor_visited: pastorVisited, comment: comment || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this activity.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 440, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>Log activity</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field"><label>Activity</label><input className="input" value={activity} onChange={(e) => setActivity(e.target.value)} /></div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field"><label>Date</label><input type="date" className="input" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} /></div>
            <div className="field"><label>Speaker/Facilitator</label><input className="input" value={speaker} onChange={(e) => setSpeaker(e.target.value)} /></div>
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field"><label>Attendance</label><input type="number" min="0" className="input" value={attendance} onChange={(e) => setAttendance(e.target.value)} /></div>
            <div className="field"><label>Offering (GHS)</label><input type="number" step="0.01" className="input" value={offering} onChange={(e) => setOffering(e.target.value)} /></div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Checkbox checked={pastorVisited} onChange={setPastorVisited} />
            <span style={{ fontSize: 13.5 }}>Pastor visited</span>
          </div>
          <div className="field"><label>Comment</label><textarea className="textarea" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
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

// Handles both create (no `ministry` prop) and edit (`ministry` passed).
function MinistryFormModal({ ministry, onClose }) {
  const [name, setName] = useState(ministry?.name ?? "");
  const [assembly, setAssembly] = useState(ministry?.assembly ?? "English");
  const [error, setError] = useState(null);
  const createMinistry = useCreateMinistry();
  const updateMinistry = useUpdateMinistry();
  const saving = createMinistry.isPending || updateMinistry.isPending;

  const onSave = async () => {
    if (!name.trim()) return setError("Name is required.");
    try {
      if (ministry) {
        await updateMinistry.mutateAsync({ id: ministry.id, name: name.trim(), assembly });
      } else {
        await createMinistry.mutateAsync({ name: name.trim(), assembly });
      }
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this ministry.");
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 420, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>{ministry ? "Edit ministry" : "Add ministry"}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label>Name</label>
            <input className="input" placeholder="e.g. Choir, Ushering…" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Service</label>
            <select className="select" value={assembly} onChange={(e) => setAssembly(e.target.value)}>
              <option value="English">English Service</option>
              <option value="Twi">Twi Service</option>
              <option value="Both">Departments</option>
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

function AddToRosterModal({ ministryId, existingIds, onAdd, onClose }) {
  const [q, setQ] = useState("");
  const { data } = useMembers({ page: 0, pageSize: 20, search: q });
  const candidates = (data?.rows ?? []).filter((m) => !existingIds.includes(m.id));

  return (
    <Modal onClose={onClose}>
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
    </Modal>
  );
}

function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?";
}
