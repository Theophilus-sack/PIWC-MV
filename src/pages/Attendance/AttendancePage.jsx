import React, { useMemo, useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Avatar } from "../../components/primitives.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { useMinistries, useMinistryRoster } from "../../hooks/useMinistries.js";
import { useMembers } from "../../hooks/useMembers.js";
import {
  useServiceDates, useCreateServiceDate, useAttendanceForService, useMarkAttendance,
} from "../../hooks/useAttendance.js";

// Ported from the original screens.jsx Attendance screen's per-member
// mark-present interaction, but now scoped by role instead of always
// showing every member: a Ministry Leader only ever sees/marks their own
// ministry's roster (RLS enforces this regardless of what the UI shows;
// this just avoids offering a control that would fail server-side).
export function AttendancePage() {
  const { role, profile } = useAuth();
  const access = accessLevel(role, "attendance"); // "full" | "view" | "log" | null
  const canMark = access === "full" || access === "log";

  const { data: ministries } = useMinistries();
  const isMinistryLeader = role === "ministry_leader";
  // Only Super Admin/Pastor operate across scopes (matrix: full/view). A
  // Secretary is locked to general services same as a Ministry Leader is
  // locked to their own ministry — the RLS insert policy already rejects a
  // Secretary creating a ministry-scoped service, but the UI shouldn't
  // offer a control that would just fail server-side.
  const canPickScope = role === "super_admin" || role === "pastor";
  const [scopeMinistryId, setScopeMinistryId] = useState(isMinistryLeader ? profile?.ministry_id ?? "" : "");
  const scope = isMinistryLeader ? profile?.ministry_id ?? "" : (canPickScope ? scopeMinistryId : "");

  const { data: services, isLoading: servicesLoading } = useServiceDates({ ministryId: scope || null });
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const activeServiceId = selectedServiceId ?? services?.[0]?.id ?? null;
  const createService = useCreateServiceDate();

  const { data: records } = useAttendanceForService(activeServiceId);
  const markAttendance = useMarkAttendance();
  const presentSet = useMemo(() => new Set((records ?? []).filter((r) => r.present).map((r) => r.member_id)), [records]);

  const [q, setQ] = useState("");
  const { data: generalMembers } = useMembers({ page: 0, pageSize: 50, search: q });
  const { data: ministryRoster } = useMinistryRoster(scope || null);

  const roster = scope
    ? (ministryRoster ?? []).map((r) => r.members).filter((m) => m && (!q || m.name.toLowerCase().includes(q.toLowerCase())))
    : (generalMembers?.rows ?? []);

  const toggle = (memberId) => {
    if (!activeServiceId || !canMark) return;
    markAttendance.mutate({ serviceDateId: activeServiceId, memberId, present: !presentSet.has(memberId) });
  };

  const startTodaysService = () => {
    const ministry = ministries?.find((m) => m.id === scope);
    createService.mutate(
      {
        serviceDate: new Date().toISOString().slice(0, 10),
        name: ministry ? `${ministry.name} Meeting` : "Sunday Service",
        ministryId: scope || null,
      },
      { onSuccess: (created) => setSelectedServiceId(created.id) }
    );
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {scope ? "Ministry gathering" : "Sunday service"}
          </div>
          <h1>{canMark ? "Mark attendance" : "Attendance"}</h1>
          <p>{canMark ? "Tap a name to mark present." : "View-only — your role can't log attendance."}</p>
        </div>
        {canPickScope && (
          <select className="select" style={{ width: 200 }} value={scopeMinistryId} onChange={(e) => { setScopeMinistryId(e.target.value); setSelectedServiceId(null); }}>
            <option value="">General (Sunday service)</option>
            {(ministries ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 320px", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="glass card" style={{ padding: 14 }}>
            <div className="row" style={{ gap: 10 }}>
              <div className="search" style={{ flex: 1, maxWidth: "none" }}>
                <Icon name="search" size={16} />
                <input placeholder="Find member to mark…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          </div>

          {!activeServiceId && !servicesLoading && (
            <div className="glass card" style={{ padding: 24, textAlign: "center" }}>
              <p className="muted" style={{ marginBottom: 12 }}>No service logged yet for this scope.</p>
              {canMark && (
                <button className="btn btn-primary" onClick={startTodaysService} disabled={createService.isPending}>
                  <Icon name="plus" size={14} /> Start today's service
                </button>
              )}
            </div>
          )}

          {activeServiceId && (
            <div className="grid cols-2" style={{ gap: 10 }}>
              {roster.map((m) => {
                const isMarked = presentSet.has(m.id);
                return (
                  <div
                    key={m.id}
                    className="glass-soft"
                    onClick={() => toggle(m.id)}
                    style={{
                      padding: 12, cursor: canMark ? "pointer" : "default", display: "flex", alignItems: "center", gap: 12,
                      background: isMarked ? "linear-gradient(135deg, color-mix(in srgb, var(--blue-500) 18%, var(--glass-bg)), color-mix(in srgb, var(--gold-500) 14%, var(--glass-bg)))" : undefined,
                    }}
                  >
                    <Avatar initials={initialsOf(m.name)} gold={m.gender === "Female"} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{m.name}</div>
                      <div className="faint mono" style={{ fontSize: 11.5 }}>{m.status}</div>
                    </div>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: isMarked ? "var(--blue-800)" : "transparent",
                      border: isMarked ? "1px solid var(--blue-800)" : "1.5px solid var(--line)",
                      display: "grid", placeItems: "center", color: "#fff",
                    }}>
                      {isMarked && <Icon name="check" size={14} stroke={2.6} />}
                    </div>
                  </div>
                );
              })}
              {roster.length === 0 && <p className="muted">No members to show.</p>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="glass card">
            <div className="eyebrow">Recent services</div>
            <h3 style={{ fontSize: 18, marginTop: 4, marginBottom: 14 }}>Pick a date</h3>
            {(services ?? []).map((s) => (
              <div key={s.id} className="row between" style={{ padding: "8px 0", cursor: "pointer" }} onClick={() => setSelectedServiceId(s.id)}>
                <span style={{ fontSize: 13.5, fontWeight: s.id === activeServiceId ? 600 : 400 }}>{s.name}</span>
                <span className="muted" style={{ fontSize: 12 }}>{new Date(s.service_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
              </div>
            ))}
            {(services ?? []).length === 0 && <p className="muted" style={{ fontSize: 13 }}>None yet.</p>}
            {canMark && services?.length > 0 && (
              <button className="btn btn-ghost" style={{ marginTop: 10, width: "100%", justifyContent: "center" }} onClick={startTodaysService}>
                <Icon name="plus" size={14} /> New service
              </button>
            )}
          </div>

          {activeServiceId && (
            <div className="glass card">
              <div className="eyebrow">This service</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                <div className="row between"><span className="muted">Marked present</span><span style={{ fontWeight: 600 }}>{presentSet.size}</span></div>
                <div className="row between"><span className="muted">Roster size</span><span style={{ fontWeight: 600 }}>{roster.length}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?";
}
