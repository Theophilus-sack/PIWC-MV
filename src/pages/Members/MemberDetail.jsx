import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import { Avatar } from "../../components/primitives.jsx";
import { useMember } from "../../hooks/useMembers.js";
import { useMemberAttendance } from "../../hooks/useAttendance.js";
import { useMemberMinistries } from "../../hooks/useMinistries.js";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { ageBracketLabel } from "../../lib/ageBracket.js";
import { EditMemberModal } from "./EditMemberModal.jsx";

// Ported from the original screens.jsx MemberDetail — same card layout,
// real data via useMember()/useMemberAttendance() instead of the fake
// deterministic-dot generator.
export function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canEdit = accessLevel(role, "members") === "full";
  const [showEdit, setShowEdit] = useState(false);
  const { data: member, isLoading, isError, error } = useMember(id);
  const { data: attendance } = useMemberAttendance(id);
  const { data: memberships } = useMemberMinistries(id);

  if (isLoading) return <div className="content" style={{ padding: 40 }}>Loading…</div>;
  if (isError) return <div className="badge badge-red" style={{ padding: "8px 12px" }}>Couldn't load this member: {error.message}</div>;
  if (!member) return null;

  const initials = (member.name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const departments = (memberships ?? []).filter((r) => r.ministries?.assembly === "Both");
  const memberMinistries = (memberships ?? []).filter((r) => r.ministries?.assembly !== "Both");

  return (
    <div className="fade-in">
      <div className="row between" style={{ marginBottom: 14, gap: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => navigate("/members")}>
            <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><Icon name="chevron" size={14} /></span>
            Members
          </button>
          <span className="faint">/</span>
          <span className="muted">{member.name}</span>
        </div>
        {canEdit && (
          <button className="btn" onClick={() => setShowEdit(true)}><Icon name="edit" size={14} /> Edit</button>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.1fr 2fr", gap: 14 }}>
        <div className="glass card" style={{ padding: 24, textAlign: "center" }}>
          <Avatar initials={initials} gold={member.gender === "Female"} size={92} />
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, marginTop: 14 }}>{member.name}</h2>
          <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 12 }}>
            <span className="badge badge-blue">{member.status}</span>
            <span className="badge">{member.gender || "—"}</span>
          </div>
          <div className="divider" />
          <div style={{ textAlign: "left" }}>
            {member.member_id && (
              <div className="row between" style={{ padding: "8px 0" }}>
                <span className="muted"><Icon name="shield" size={14} /> Member ID</span>
                <span className="mono" style={{ fontSize: 12.5 }}>{member.member_id}</span>
              </div>
            )}
            {member.date_joined && (
              <div className="row between" style={{ padding: "8px 0" }}>
                <span className="muted"><Icon name="calendar" size={14} /> Year of joining</span>
                <span>{new Date(member.date_joined).getFullYear()}</span>
              </div>
            )}
            <div className="row between" style={{ padding: "8px 0" }}>
              <span className="muted"><Icon name="phone" size={14} /> Phone</span>
              <span className="mono" style={{ fontSize: 12.5 }}>{member.contact || "—"}</span>
            </div>
            {member.whatsapp_number && (
              <div className="row between" style={{ padding: "8px 0" }}>
                <span className="muted"><Icon name="phone" size={14} /> WhatsApp number</span>
                <span className="mono" style={{ fontSize: 12.5 }}>{member.whatsapp_number}</span>
              </div>
            )}
            <div className="row between" style={{ padding: "8px 0" }}>
              <span className="muted"><Icon name="calendar" size={14} /> Joined</span>
              <span>{member.date_joined ? new Date(member.date_joined).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</span>
            </div>
            <div className="row between" style={{ padding: "8px 0" }}>
              <span className="muted"><Icon name="pin" size={14} /> Residence</span>
              <span>{member.residence || "—"}</span>
            </div>
            <div className="row between" style={{ padding: "8px 0" }}>
              <span className="muted"><Icon name="church" size={14} /> Assembly</span>
              <span>{member.preferred_assembly || "—"}</span>
            </div>
            <div className="row between" style={{ padding: "8px 0" }}>
              <span className="muted"><Icon name="pin" size={14} /> Nationality</span>
              <span>{member.nationality || "—"}</span>
            </div>
            <div className="row between" style={{ padding: "8px 0" }}>
              <span className="muted"><Icon name="user" size={14} /> Marital status</span>
              <span>{member.marital_status || "—"}</span>
            </div>
            <div className="row between" style={{ padding: "8px 0" }}>
              <span className="muted"><Icon name="sparkle" size={14} /> Age bracket</span>
              <span>{ageBracketLabel(member.date_of_birth)}</span>
            </div>
            {member.date_of_birth && (
              <div className="row between" style={{ padding: "8px 0" }}>
                <span className="muted"><Icon name="sparkle" size={14} /> Date of birth</span>
                <span>{new Date(member.date_of_birth).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</span>
              </div>
            )}
            {member.visiting_from && (
              <div className="row between" style={{ padding: "8px 0" }}>
                <span className="muted"><Icon name="pin" size={14} /> Visiting from</span>
                <span>{member.visiting_from}</span>
              </div>
            )}
            {member.educational_institution && (
              <div className="row between" style={{ padding: "8px 0" }}>
                <span className="muted"><Icon name="church" size={14} /> Educational institution</span>
                <span>{member.educational_institution}</span>
              </div>
            )}
            {member.workplace_name && (
              <div className="row between" style={{ padding: "8px 0" }}>
                <span className="muted"><Icon name="church" size={14} /> Workplace</span>
                <span>{member.workplace_name}</span>
              </div>
            )}
            {member.educational_professional_background && (
              <div style={{ padding: "8px 0" }}>
                <span className="muted"><Icon name="edit" size={14} /> Educational/professional background</span>
                <p style={{ margin: "4px 0 0", fontSize: 13 }}>{member.educational_professional_background}</p>
              </div>
            )}
            {departments.length > 0 && (
              <div style={{ padding: "8px 0" }}>
                <span className="muted"><Icon name="church" size={14} /> Department</span>
                <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {departments.map((r) => <span key={r.id} className="badge badge-gold">{r.ministries.name}</span>)}
                </div>
              </div>
            )}
            {memberMinistries.length > 0 && (
              <div style={{ padding: "8px 0" }}>
                <span className="muted"><Icon name="church" size={14} /> Ministry</span>
                <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {memberMinistries.map((r) => <span key={r.id} className="badge badge-blue">{r.ministries.name}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="glass card">
            <div className="eyebrow">Attendance history</div>
            <h3 style={{ fontSize: 18, marginTop: 4, marginBottom: 14 }}>Recent services</h3>
            {(!attendance || attendance.length === 0) && (
              <p className="muted" style={{ fontSize: 13.5 }}>No attendance recorded yet.</p>
            )}
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {(attendance ?? []).map((r, i) => (
                <div key={i} className="glass-soft" style={{ padding: "10px 12px", flex: "1 1 140px", minWidth: 140 }}>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {new Date(r.service_dates.service_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{r.service_dates.name}</span>
                    <span className={"badge " + (r.present ? "badge-green" : "badge-red")}>
                      <Icon name={r.present ? "check" : "x"} size={11} stroke={2.4} />
                      {r.present ? "Present" : "Absent"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showEdit && <EditMemberModal member={member} onClose={() => setShowEdit(false)} />}
    </div>
  );
}
