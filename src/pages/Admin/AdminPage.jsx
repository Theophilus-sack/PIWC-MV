import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { ROLES, ROLE_LABELS } from "../../lib/rbac.js";
import { useProfiles, useUpdateProfileRole } from "../../hooks/useProfiles.js";
import { useMinistries } from "../../hooks/useMinistries.js";

// Super Admin/Pastor only (rbac's admin module + profiles_update_admins
// RLS in 0001_foundation.sql — "Only Super Admin and Pastor can create/
// assign roles"). Creating brand-new logins still happens via the
// Supabase dashboard (see supabase/README.md's bootstrap step) — this
// page manages roles for accounts that already exist, it doesn't invite
// new ones (that needs a service-role Edge Function, a separate piece).
export function AdminPage() {
  const { data: profiles, isLoading, isError, error } = useProfiles();
  const { data: ministries } = useMinistries();
  const { user } = useAuth();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Admin</div>
          <h1>User roles</h1>
          <p>Assign roles and ministry scope. New logins are created via Authentication → Users in the Supabase dashboard.</p>
        </div>
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
    </div>
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
