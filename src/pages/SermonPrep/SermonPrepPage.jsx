import React, { useState } from "react";
import { Icon } from "../../components/Icon.jsx";
import {
  useSermonNotes, useCreateSermonNote, useUpdateSermonNote, useDeleteSermonNote,
} from "../../hooks/useSermonNotes.js";

// Pastor-exclusive per the permission matrix — no one else, including
// Super Admin, can reach this page (route-guarded by rbac's sermon_prep
// module, backed by RLS in 0011_sermon_notes.sql that has no super_admin
// carve-out). List + a full editor view rather than a modal, since sermon
// content is long-form writing, not a quick form.
export function SermonPrepPage() {
  const { data: notes, isLoading, isError, error } = useSermonNotes();
  const [editingId, setEditingId] = useState(undefined); // undefined = list view, null = new note, id = editing

  if (editingId !== undefined) {
    return <SermonEditor noteId={editingId} onClose={() => setEditingId(undefined)} />;
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Word Prep</div>
          <h1>Sermon notes</h1>
          <p>Your exclusive space — no one else, including Super Admin, can see this.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditingId(null)}><Icon name="plus" size={15} /> New sermon</button>
      </div>

      {isError && <div className="badge badge-red" style={{ display: "block", padding: "8px 12px", marginBottom: 14 }}>Couldn't load sermon notes: {error.message}</div>}

      {isLoading && <p className="muted">Loading…</p>}
      {!isLoading && (notes ?? []).length === 0 && (
        <div className="glass card" style={{ padding: 40, textAlign: "center" }}>
          <p className="muted">No sermon notes yet.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setEditingId(null)}>
            <Icon name="plus" size={15} /> Write your first
          </button>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {(notes ?? []).map((n) => (
          <div key={n.id} className="glass card" style={{ cursor: "pointer" }} onClick={() => setEditingId(n.id)}>
            <div className="row between">
              <span className={"badge " + (n.status === "published" ? "badge-green" : "badge-gold")}>
                {n.status === "published" ? "Published" : "Draft"}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                {new Date(n.sermon_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>
            <h3 style={{ fontSize: 17, marginTop: 10 }}>{n.title}</h3>
            {n.scripture_ref && <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>{n.scripture_ref}</p>}
            <p className="muted" style={{ fontSize: 13, marginTop: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {n.content || "No content yet."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SermonEditor({ noteId, onClose }) {
  const { data: notes } = useSermonNotes();
  const note = noteId ? (notes ?? []).find((n) => n.id === noteId) : null;

  const [title, setTitle] = useState(note?.title ?? "");
  const [scriptureRef, setScriptureRef] = useState(note?.scripture_ref ?? "");
  const [sermonDate, setSermonDate] = useState(note?.sermon_date ?? new Date().toISOString().slice(0, 10));
  const [content, setContent] = useState(note?.content ?? "");
  const [status, setStatus] = useState(note?.status ?? "draft");
  const [error, setError] = useState(null);

  const createNote = useCreateSermonNote();
  const updateNote = useUpdateSermonNote();
  const deleteNote = useDeleteSermonNote();
  const saving = createNote.isPending || updateNote.isPending;

  const onSave = async (nextStatus) => {
    if (!title.trim()) return setError("Title is required.");
    try {
      if (noteId) {
        await updateNote.mutateAsync({ id: noteId, title: title.trim(), scriptureRef, sermonDate, content, status: nextStatus ?? status });
      } else {
        await createNote.mutateAsync({ title: title.trim(), scriptureRef, sermonDate, content, status: nextStatus ?? status });
      }
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this sermon note.");
    }
  };

  const onDelete = () => {
    if (!confirm(`Delete "${title || "this sermon note"}"? This can't be undone.`)) return;
    deleteNote.mutate(noteId, { onSuccess: onClose });
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Word Prep</div>
          <h1>{noteId ? "Edit sermon" : "New sermon"}</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Back</button>
          {noteId && <button className="btn btn-icon btn-ghost" onClick={onDelete}><Icon name="trash" size={15} /></button>}
        </div>
      </div>

      <div className="glass card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
          <div className="field"><label>Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sermon title" /></div>
          <div className="field"><label>Scripture reference</label><input className="input" value={scriptureRef} onChange={(e) => setScriptureRef(e.target.value)} placeholder="e.g. John 3:16" /></div>
          <div className="field"><label>Date</label><input type="date" className="input" value={sermonDate} onChange={(e) => setSermonDate(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea className="textarea" rows={16} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your sermon notes…" />
        </div>
        {error && <div className="badge badge-red" style={{ display: "block", padding: "8px 12px" }}>{error}</div>}
        <div className="row between">
          <span className={"badge " + (status === "published" ? "badge-green" : "badge-gold")}>{status === "published" ? "Published" : "Draft"}</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => { setStatus("draft"); onSave("draft"); }} disabled={saving}>Save as draft</button>
            <button className="btn btn-primary" onClick={() => { setStatus("published"); onSave("published"); }} disabled={saving}>
              {saving ? "Saving…" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
