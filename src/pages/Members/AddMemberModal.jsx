import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Switch } from "../../components/primitives.jsx";
import { useCreateMember } from "../../hooks/useMembers.js";
import { useMinistries, useAddMinistryMember } from "../../hooks/useMinistries.js";

const emptyForm = {
  name: "", contact: "", gender: "Female", residence: "",
  preferred_assembly: "English", date_of_birth: "",
  date_joined: new Date().toISOString().slice(0, 10),
  ministry_id: "",
};

// Ported from the original screens.jsx AddMemberModal, extended per
// feedback from the first real add-member pass: date of birth, an
// optional ministry to join at creation, and a two-step first-timer flow
// (Is this a first-timer? -> if yes, Stay or Visit + where they're
// visiting from) instead of one flat status dropdown. The modal card now
// caps its own height and scrolls internally — the fixed-overlay
// centering was fine, but a form this size on a shorter window had no way
// to reach the fields below the fold.
export function AddMemberModal({ onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [isFirstTimer, setIsFirstTimer] = useState(true);
  const [intent, setIntent] = useState(""); // "stay" | "visit", only when isFirstTimer
  const [error, setError] = useState(null);

  const { data: ministries } = useMinistries();
  const createMember = useCreateMember();
  const addMinistryMember = useAddMinistryMember();

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onSave = async () => {
    setError(null);
    if (!form.name.trim()) return setError("Name is required.");
    if (isFirstTimer && !intent) return setError("Choose whether this first-timer is expected to stay or was a one-off visit.");

    const { ministry_id, ...memberFields } = form;
    const payload = {
      ...memberFields,
      status: isFirstTimer ? intent : "stay",
      visiting_from: isFirstTimer ? form.visiting_from || null : null,
      date_of_birth: form.date_of_birth || null,
    };

    try {
      const created = await createMember.mutateAsync(payload);
      if (ministry_id) {
        await addMinistryMember.mutateAsync({ ministryId: ministry_id, memberId: created.id });
      }
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this member.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="glass modal-card"
        style={{ maxWidth: 520, padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
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
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Date of birth <span className="faint">(optional)</span></label>
              <input type="date" className="input" value={form.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} />
            </div>
            <div className="field">
              <label>Residence</label>
              <input className="input" placeholder="Mountain View Estates" value={form.residence} onChange={(e) => set({ residence: e.target.value })} />
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

          <div className="field">
            <label>Ministry <span className="faint">(optional)</span></label>
            <select className="select" value={form.ministry_id} onChange={(e) => set({ ministry_id: e.target.value })}>
              <option value="">— None —</option>
              {(ministries ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}{m.assembly ? ` (${m.assembly})` : ""}</option>)}
            </select>
          </div>

          <div className="divider" style={{ margin: "4px 0" }} />

          <div className="row between">
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Is this person a first-timer?</div>
              <div className="muted" style={{ fontSize: 12 }}>Visiting the church for the first time.</div>
            </div>
            <Switch on={isFirstTimer} onChange={(v) => { setIsFirstTimer(v); if (!v) setIntent(""); }} />
          </div>

          {isFirstTimer && (
            <div className="glass-soft" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Expected to</label>
                <select className="select" value={intent} onChange={(e) => setIntent(e.target.value)}>
                  <option value="">Select…</option>
                  <option value="stay">Stay — likely to become a regular</option>
                  <option value="visit">Visit — one-off visit</option>
                </select>
              </div>
              <div className="field">
                <label>Visiting from <span className="faint">(optional)</span></label>
                <input className="input" placeholder="e.g. PIWC Adenta, or a town/area" value={form.visiting_from ?? ""} onChange={(e) => set({ visiting_from: e.target.value })} />
              </div>
            </div>
          )}
        </div>

        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}

        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={createMember.isPending || addMinistryMember.isPending}>
            <Icon name="check" size={14} stroke={2.4} /> {createMember.isPending ? "Saving…" : "Save member"}
          </button>
        </div>
      </div>
    </div>
  );
}
