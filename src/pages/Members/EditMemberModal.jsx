import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { useUpdateMember } from "../../hooks/useMembers.js";

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
  });
  const [error, setError] = useState(null);
  const updateMember = useUpdateMember();

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
      });
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save these changes.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 520, padding: 28 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <div>
            <div className="eyebrow">Edit record</div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, marginTop: 4 }}>Edit member</h2>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
        </div>

        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}

        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={updateMember.isPending}>
            <Icon name="check" size={14} stroke={2.4} /> {updateMember.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
