import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { Switch, Checkbox } from "../../components/primitives.jsx";
import { useCreateMember } from "../../hooks/useMembers.js";
import { useMinistries, useAddMinistryMemberships } from "../../hooks/useMinistries.js";
import { groupByAssembly } from "../../lib/assembly.js";
import { COUNTRIES } from "../../lib/countries.js";

const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed", "Engaged", "Separated"];

const emptyForm = {
  name: "", contact: "", email: "", gender: "Female", residence: "",
  preferred_assembly: "English", date_of_birth: "",
  date_joined: new Date().toISOString().slice(0, 10),
  nationality: "Ghana", marital_status: "", whatsapp_number: "", skills_talents: "",
  educational_professional_background: "", educational_institution: "", workplace_name: "",
};

// Ported from the original screens.jsx AddMemberModal, extended per
// feedback from the first real add-member pass: date of birth, a
// two-step first-timer flow (Is this a first-timer? -> if yes, Stay or
// Visit + where they're visiting from) instead of one flat status
// dropdown, and — a member can belong to more than one ministry, so this
// is a checkbox multi-select grouped by service, not a single dropdown.
// The modal card caps its own height and scrolls internally.
export function AddMemberModal({ onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [isFirstTimer, setIsFirstTimer] = useState(true);
  const [intent, setIntent] = useState(""); // "stay" | "visit", only when isFirstTimer
  const [departmentIds, setDepartmentIds] = useState([]);
  const [ministryIds, setMinistryIds] = useState([]);
  const [error, setError] = useState(null);

  const { data: ministries } = useMinistries();
  // Department = the ministries table's assembly='Both' category (already
  // labeled "Departments" in Groups/Leadership); Ministry = English/Twi.
  // Same join table (ministry_members) either way — two separate pickers
  // over one list, filtered by assembly, not a new concept.
  const departmentOptions = (ministries ?? []).filter((m) => m.assembly === "Both");
  const ministrySections = groupByAssembly((ministries ?? []).filter((m) => m.assembly !== "Both"));
  const createMember = useCreateMember();
  const addMinistryMemberships = useAddMinistryMemberships();

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleDepartment = (id) => setDepartmentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const toggleMinistry = (id) => setMinistryIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const onSave = async () => {
    setError(null);
    if (!form.name.trim()) return setError("Name is required.");
    if (isFirstTimer && !intent) return setError("Choose whether this first-timer is expected to stay or was a one-off visit.");

    const payload = {
      ...form,
      status: isFirstTimer ? intent : "stay",
      visiting_from: isFirstTimer ? form.visiting_from || null : null,
      date_of_birth: form.date_of_birth || null,
      email: form.email || null,
      marital_status: form.marital_status || null,
      whatsapp_number: form.whatsapp_number || null,
      skills_talents: form.skills_talents || null,
      educational_professional_background: form.educational_professional_background || null,
      educational_institution: form.educational_institution || null,
      workplace_name: form.workplace_name || null,
    };

    const allMinistryIds = [...departmentIds, ...ministryIds];
    try {
      const created = await createMember.mutateAsync(payload);
      if (allMinistryIds.length) {
        await addMinistryMemberships.mutateAsync({ memberId: created.id, ministryIds: allMinistryIds });
      }
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this member.");
    }
  };

  return (
    <Modal onClose={onClose}>
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
              <label>Email <span className="faint">(optional)</span></label>
              <input type="email" className="input" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </div>
            <div className="field">
              <label>Date of birth <span className="faint">(optional)</span></label>
              <input type="date" className="input" value={form.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} />
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
              <label>Date joined</label>
              <input type="date" className="input" value={form.date_joined} onChange={(e) => set({ date_joined: e.target.value })} />
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
            <input className="input" placeholder="+233 24 …" value={form.whatsapp_number} onChange={(e) => set({ whatsapp_number: e.target.value })} />
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
          <div className="field">
            <label>Skills / talents <span className="faint">(optional)</span></label>
            <textarea className="textarea" rows={2} value={form.skills_talents} onChange={(e) => set({ skills_talents: e.target.value })} />
          </div>

          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Department <span className="faint">(optional)</span></label>
              <div className="glass-soft" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                {departmentOptions.map((d) => (
                  <label key={d.id} className="row" style={{ gap: 8, padding: "4px 0", cursor: "pointer" }}>
                    <Checkbox checked={departmentIds.includes(d.id)} onChange={() => toggleDepartment(d.id)} />
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
                        <Checkbox checked={ministryIds.includes(m.id)} onChange={() => toggleMinistry(m.id)} />
                        <span style={{ fontSize: 13.5 }}>{m.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
                {ministrySections.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No ministries yet.</p>}
              </div>
            </div>
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
          <button className="btn btn-primary" onClick={onSave} disabled={createMember.isPending || addMinistryMemberships.isPending}>
            <Icon name="check" size={14} stroke={2.4} /> {createMember.isPending ? "Saving…" : "Save member"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
