import React, { useState, useEffect } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { Checkbox } from "../../components/primitives.jsx";
import { useUpdateMember } from "../../hooks/useMembers.js";
import { useMinistries, useMemberMinistries, useAddMinistryMemberships, useRemoveMinistryMember } from "../../hooks/useMinistries.js";
import { groupByAssembly } from "../../lib/assembly.js";
import { COUNTRIES } from "../../lib/countries.js";

const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed", "Engaged", "Separated"];

// Direct field editor for an existing member — unlike AddMemberModal's
// two-step first-timer flow (which only makes sense at intake), editing
// just exposes the stored fields as-is, including 'first-timer' as a
// flat status option for legacy records that still carry it.
export function EditMemberModal({ member, onClose }) {
  const [form, setForm] = useState({
    name: member.name ?? "",
    contact: member.contact ?? "",
    gender: member.gender ?? "Female",
    residence: member.residence ?? "",
    preferred_assembly: member.preferred_assembly ?? "English",
    status: member.status ?? "stay",
    date_joined: member.date_joined ?? "",
    date_of_birth: member.date_of_birth ?? "",
    visiting_from: member.visiting_from ?? "",
    nationality: member.nationality ?? "Ghana",
    marital_status: member.marital_status ?? "",
    whatsapp_number: member.whatsapp_number ?? "",
    educational_professional_background: member.educational_professional_background ?? "",
    educational_institution: member.educational_institution ?? "",
    workplace_name: member.workplace_name ?? "",
  });
  const [error, setError] = useState(null);
  const updateMember = useUpdateMember();

  const { data: ministries } = useMinistries();
  const { data: currentMemberships } = useMemberMinistries(member.id);
  const addMinistryMemberships = useAddMinistryMemberships();
  const removeMinistryMember = useRemoveMinistryMember();

  const departmentOptions = (ministries ?? []).filter((m) => m.assembly === "Both");
  const ministrySections = groupByAssembly((ministries ?? []).filter((m) => m.assembly !== "Both"));

  // Local selection state seeded from what's currently linked, so toggling
  // checkboxes here doesn't write anything until Save is pressed.
  const [selectedIds, setSelectedIds] = useState(null);
  useEffect(() => {
    if (currentMemberships) setSelectedIds(new Set(currentMemberships.map((r) => r.ministry_id)));
  }, [currentMemberships]);
  const toggleLink = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onSave = async () => {
    setError(null);
    if (!form.name.trim()) return setError("Name is required.");
    try {
      await updateMember.mutateAsync({
        id: member.id,
        ...form,
        date_of_birth: form.date_of_birth || null,
        visiting_from: form.visiting_from || null,
        marital_status: form.marital_status || null,
        whatsapp_number: form.whatsapp_number || null,
        educational_professional_background: form.educational_professional_background || null,
        educational_institution: form.educational_institution || null,
        workplace_name: form.workplace_name || null,
      });

      // Reconcile Department/Ministry links against what was there before.
      const before = new Set((currentMemberships ?? []).map((r) => r.ministry_id));
      const after = selectedIds ?? before;
      const toAdd = [...after].filter((id) => !before.has(id));
      const toRemove = (currentMemberships ?? []).filter((r) => !after.has(r.ministry_id));
      if (toAdd.length) await addMinistryMemberships.mutateAsync({ memberId: member.id, ministryIds: toAdd });
      for (const r of toRemove) {
        await removeMinistryMember.mutateAsync({ id: r.id, ministryId: r.ministry_id, memberId: member.id });
      }

      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save these changes.");
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 520, padding: 28 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <div>
            <div className="eyebrow">Edit record</div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, marginTop: 4 }}>Edit member</h2>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {member.member_id && (
            <div className="field">
              <label>Member ID</label>
              <div className="mono muted" style={{ fontSize: 13 }}>{member.member_id} <span className="faint" style={{ fontSize: 11 }}>(server-generated, can't be changed)</span></div>
            </div>
          )}
          <div className="field">
            <label>Full name</label>
            <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Phone number</label>
              <input className="input" value={form.contact} onChange={(e) => set({ contact: e.target.value })} />
            </div>
            <div className="field">
              <label>Gender</label>
              <select className="select" value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                <option>Female</option><option>Male</option>
              </select>
            </div>
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Date of birth <span className="faint">(optional)</span></label>
              <input type="date" className="input" value={form.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} />
            </div>
            <div className="field">
              <label>Residence</label>
              <input className="input" value={form.residence} onChange={(e) => set({ residence: e.target.value })} />
            </div>
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Preferred assembly</label>
              <select className="select" value={form.preferred_assembly} onChange={(e) => set({ preferred_assembly: e.target.value })}>
                <option value="English">English</option><option value="Twi">Twi</option>
              </select>
            </div>
            <div className="field">
              <label>Date joined</label>
              <input type="date" className="input" value={form.date_joined} onChange={(e) => set({ date_joined: e.target.value })} />
            </div>
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Status</label>
              <select className="select" value={form.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="first-timer">First-timer</option>
                <option value="stay">Stay</option>
                <option value="visit">Visit</option>
              </select>
            </div>
            <div className="field">
              <label>Visiting from <span className="faint">(optional)</span></label>
              <input className="input" value={form.visiting_from} onChange={(e) => set({ visiting_from: e.target.value })} />
            </div>
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Nationality</label>
              <select className="select" value={form.nationality} onChange={(e) => set({ nationality: e.target.value })}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Marital status <span className="faint">(optional)</span></label>
              <select className="select" value={form.marital_status} onChange={(e) => set({ marital_status: e.target.value })}>
                <option value="">Not specified</option>
                {MARITAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>WhatsApp number <span className="faint">(optional)</span></label>
            <input className="input" value={form.whatsapp_number} onChange={(e) => set({ whatsapp_number: e.target.value })} />
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Educational institution <span className="faint">(optional)</span></label>
              <input className="input" value={form.educational_institution} onChange={(e) => set({ educational_institution: e.target.value })} />
            </div>
            <div className="field">
              <label>Name of workplace <span className="faint">(optional)</span></label>
              <input className="input" value={form.workplace_name} onChange={(e) => set({ workplace_name: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Educational/professional background <span className="faint">(optional)</span></label>
            <textarea className="textarea" rows={2} value={form.educational_professional_background} onChange={(e) => set({ educational_professional_background: e.target.value })} />
          </div>

          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Department <span className="faint">(optional)</span></label>
              <div className="glass-soft" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                {departmentOptions.map((d) => (
                  <label key={d.id} className="row" style={{ gap: 8, padding: "4px 0", cursor: "pointer" }}>
                    <Checkbox checked={selectedIds?.has(d.id) ?? false} onChange={() => toggleLink(d.id)} />
                    <span style={{ fontSize: 13.5 }}>{d.name}</span>
                  </label>
                ))}
                {departmentOptions.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No departments yet.</p>}
              </div>
            </div>
            <div className="field">
              <label>Ministry <span className="faint">(optional, can pick more than one)</span></label>
              <div className="glass-soft" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                {ministrySections.map((section) => (
                  <div key={section.label}>
                    <div className="eyebrow" style={{ margin: "6px 0 2px" }}>{section.label}</div>
                    {section.items.map((m) => (
                      <label key={m.id} className="row" style={{ gap: 8, padding: "4px 0", cursor: "pointer" }}>
                        <Checkbox checked={selectedIds?.has(m.id) ?? false} onChange={() => toggleLink(m.id)} />
                        <span style={{ fontSize: 13.5 }}>{m.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
                {ministrySections.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No ministries yet.</p>}
              </div>
            </div>
          </div>
        </div>

        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}

        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={updateMember.isPending || addMinistryMemberships.isPending || removeMinistryMember.isPending}>
            <Icon name="check" size={14} stroke={2.4} /> {updateMember.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
