import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { useCreateMember } from "../../hooks/useMembers.js";

const emptyForm = {
  name: "", contact: "", gender: "Female", residence: "",
  preferred_assembly: "English", status: "first-timer",
  date_joined: new Date().toISOString().slice(0, 10),
};

// Ported from the original screens.jsx AddMemberModal — same layout, real
// fields (residence/preferred assembly/status instead of department), and
// now actually persists via useCreateMember instead of just closing.
export function AddMemberModal({ onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const createMember = useCreateMember();

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onSave = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    try {
      await createMember.mutateAsync(form);
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this member.");
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center",
        background: "color-mix(in srgb, var(--blue-900) 40%, transparent)",
        backdropFilter: "blur(8px)", padding: 24,
      }}
      onClick={onClose}
    >
      <div className="glass" style={{ width: "100%", maxWidth: 520, padding: 28 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <div>
            <div className="eyebrow">New record</div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, marginTop: 4 }}>Add a member</h2>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label>Full name</label>
            <input className="input" placeholder="Akwasi Mensah" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Phone number</label>
              <input className="input" placeholder="+233 24 …" value={form.contact} onChange={(e) => set({ contact: e.target.value })} />
            </div>
            <div className="field">
              <label>Gender</label>
              <select className="select" value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                <option>Female</option><option>Male</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Residence</label>
            <input className="input" placeholder="Mountain View Estates" value={form.residence} onChange={(e) => set({ residence: e.target.value })} />
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Preferred assembly</label>
              <select className="select" value={form.preferred_assembly} onChange={(e) => set({ preferred_assembly: e.target.value })}>
                <option value="English">English</option><option value="Twi">Twi</option>
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select className="select" value={form.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="first-timer">First-timer</option>
                <option value="stay">Stay</option>
                <option value="visit">Visit</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Date joined</label>
            <input type="date" className="input" value={form.date_joined} onChange={(e) => set({ date_joined: e.target.value })} />
          </div>
        </div>

        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}

        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={createMember.isPending}>
            <Icon name="check" size={14} stroke={2.4} /> {createMember.isPending ? "Saving…" : "Save member"}
          </button>
        </div>
      </div>
    </div>
  );
}
