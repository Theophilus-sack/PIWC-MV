import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { ROLES, ROLE_LABELS } from "../../lib/rbac.js";
import { useProfiles, useUpdateProfileRole, useInviteUser } from "../../hooks/useProfiles.js";
import { useMinistries } from "../../hooks/useMinistries.js";

// Super Admin/Pastor only (rbac's admin module + profiles_update_admins
// RLS in 0001_foundation.sql — "Only Super Admin and Pastor can create/
// assign roles"). Inviting a new login goes through the invite-user Edge
// Function (service-role key, never exposed client-side — see that
// function's own comment); this page still manages roles for accounts
// that already exist via direct profiles updates, same as before.
export function AdminPage() {
  const { data: profiles, isLoading, isError, error } = useProfiles();
  const { data: ministries } = useMinistries();
  const { user } = useAuth();
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Admin</div>
          <h1>User roles</h1>
          <p>Invite new logins and assign roles and ministry scope.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowInvite(true)}><Icon name="plus" size={15} /> Invite user</button>
      </div>

      <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
        {isError && (
          <div className="badge badge-red" style={{ display: "block", margin: 18, padding: "8px 12px" }}>
            Couldn't load users: {error.message}
          </div>
        )}
        <ScrollX>
          <table className="table">
            <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Ministry</th><th></th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
              {!isLoading && (profiles ?? []).length === 0 && (
                <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: "center" }}>No users found.</td></tr>
              )}
              {(profiles ?? []).map((p) => (
                <ProfileRow key={p.id} profile={p} ministries={ministries ?? []} isSelf={p.id === user?.id} />
              ))}
            </tbody>
          </table>
        </ScrollX>
      </div>

      {showInvite && <InviteUserModal ministries={ministries ?? []} onClose={() => setShowInvite(false)} />}
    </div>
  );
}

function InviteUserModal({ ministries, onClose }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [ministryId, setMinistryId] = useState("");
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const inviteUser = useInviteUser();

  const onSave = async () => {
    if (!email.trim()) return setError("Email is required.");
    if (!fullName.trim()) return setError("Full name is required.");
    if (role === "ministry_leader" && !ministryId) return setError("Pick a ministry for a Ministry Leader.");
    try {
      await inviteUser.mutateAsync({ email: email.trim(), fullName: fullName.trim(), role: role || null, ministryId });
      setSent(true);
    } catch (err) {
      setError(err.message || "Couldn't send the invite.");
    }
  };

  if (sent) {
    return (
      <Modal onClose={onClose}>
        <div className="glass modal-card" style={{ maxWidth: 420, padding: 26 }} onClick={(e) => e.stopPropagation()}>
          <div className="row" style={{ gap: 10, marginBottom: 10 }}>
            <Icon name="check" size={18} />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500 }}>Invite sent</h2>
          </div>
          <p className="muted" style={{ fontSize: 13.5 }}>
            {fullName} will get an email at {email} to set their password and sign in.
            {role && ` Their role is already set to ${ROLE_LABELS[role]}.`}
          </p>
          <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 440, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>Invite user</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field"><label>Full name</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="field"><label>Email</label><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field">
            <label>Role (optional — can also assign later)</label>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">— No access yet —</option>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {role === "ministry_leader" && (
            <div className="field">
              <label>Ministry</label>
              <select className="select" value={ministryId} onChange={(e) => setMinistryId(e.target.value)}>
                <option value="">— Select ministry —</option>
                {ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
        </div>
        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={inviteUser.isPending}>
            {inviteUser.isPending ? "Sending…" : "Send invite"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProfileRow({ profile, ministries, isSelf }) {
  const [role, setRole] = useState(profile.role ?? "");
  const [ministryId, setMinistryId] = useState(profile.ministry_id ?? "");
  const updateRole = useUpdateProfileRole();

  const dirty = role !== (profile.role ?? "") || (role === "ministry_leader" && ministryId !== (profile.ministry_id ?? ""));

  const onSave = () => {
    if (!role) return;
    updateRole.mutate({ id: profile.id, role, ministryId });
  };

  return (
    <tr>
      <td style={{ fontWeight: 500 }}>{profile.full_name}</td>
      <td className="mono muted" style={{ fontSize: 12.5 }}>{profile.phone || "—"}</td>
      <td>
        <select className="select" style={{ height: 34, width: 170 }} value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf}>
          <option value="">— No access —</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </td>
      <td>
        {role === "ministry_leader" ? (
          <select className="select" style={{ height: 34, width: 170 }} value={ministryId} onChange={(e) => setMinistryId(e.target.value)} disabled={isSelf}>
            <option value="">— Select ministry —</option>
            {ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        ) : (
          <span className="faint">—</span>
        )}
      </td>
      <td>
        {isSelf ? (
          <span className="badge" style={{ fontSize: 11 }}>You</span>
        ) : (
          <button className="btn btn-ghost" style={{ height: 32, fontSize: 12.5 }} onClick={onSave} disabled={!dirty || updateRole.isPending}>
            <Icon name="check" size={13} /> Save
          </button>
        )}
      </td>
    </tr>
  );
}
