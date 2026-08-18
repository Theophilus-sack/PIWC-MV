import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import { Modal } from "../../components/Modal.jsx";
import { ScrollX } from "../../components/ScrollX.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { accessLevel } from "../../lib/rbac.js";
import { useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem } from "../../hooks/useInventory.js";

const CONDITIONS = ["New", "Good", "Fair", "Poor", "Needs Repair"];
const CONDITION_BADGE = { New: "badge-green", Good: "badge-blue", Fair: "badge-gold", Poor: "badge-red", "Needs Repair": "badge-red" };

export function InventoryPage() {
  const { role } = useAuth();
  const access = accessLevel(role, "inventory"); // "full" | "view" (route already blocks null)
  const canEdit = access === "full";
  const { data: items, isLoading, isError, error } = useInventory();
  const deleteItem = useDeleteInventoryItem();
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = (items ?? []).filter((i) => !q || i.item.toLowerCase().includes(q.toLowerCase()) || (i.location ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Inventory</div>
          <h1>Church inventory</h1>
          <p>{canEdit ? "Track items, quantities, and condition." : "View-only — your role can't edit inventory."}</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowAdd(true); }}><Icon name="plus" size={15} /> Add item</button>
        )}
      </div>

      <div className="glass card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="search" style={{ maxWidth: "none" }}>
          <Icon name="search" size={16} />
          <input placeholder="Search by item or location…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="glass card" style={{ padding: 0, overflow: "hidden" }}>
        {isError && <div className="badge badge-red" style={{ display: "block", margin: 18, padding: "8px 12px" }}>Couldn't load inventory: {error.message}</div>}
        <ScrollX>
          <table className="table">
            <thead><tr><th>Item</th><th>Quantity</th><th>Location</th><th>Condition</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: "center" }}>Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: "center" }}>{items?.length ? "No items match." : "No inventory items yet."}</td></tr>
              )}
              {filtered.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 500 }}>{i.item}</td>
                  <td>{i.quantity}</td>
                  <td className="muted">{i.location || "—"}</td>
                  <td>{i.condition ? <span className={"badge " + (CONDITION_BADGE[i.condition] ?? "")}>{i.condition}</span> : "—"}</td>
                  <td className="muted" style={{ fontSize: 13 }}>{i.notes || "—"}</td>
                  <td>
                    {canEdit && (
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn btn-icon btn-ghost" onClick={() => { setEditing(i); setShowAdd(true); }}><Icon name="edit" size={14} /></button>
                        <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm(`Delete "${i.item}"?`)) deleteItem.mutate(i.id); }}><Icon name="trash" size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </div>

      {showAdd && <InventoryFormModal item={editing} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function InventoryFormModal({ item, onClose }) {
  const [name, setName] = useState(item?.item ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [location, setLocation] = useState(item?.location ?? "");
  const [condition, setCondition] = useState(item?.condition ?? "Good");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [error, setError] = useState(null);
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const saving = createItem.isPending || updateItem.isPending;

  const onSave = async () => {
    if (!name.trim()) return setError("Item name is required.");
    const payload = { item: name.trim(), quantity: Number(quantity) || 0, location: location || null, condition, notes: notes || null };
    try {
      if (item) await updateItem.mutateAsync({ id: item.id, ...payload });
      else await createItem.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this item.");
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 440, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>{item ? "Edit item" : "Add item"}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field"><label>Item</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field"><label>Quantity</label><input type="number" min="0" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
            <div className="field">
              <label>Condition</label>
              <select className="select" value={condition} onChange={(e) => setCondition(e.target.value)}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Location</label><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="field"><label>Notes</label><textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
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
