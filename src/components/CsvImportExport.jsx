import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import { Modal } from "./Modal.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { toCsv, downloadCsv } from "../lib/csv.js";
import { IMPORT_TARGETS } from "../lib/importTargets.js";
import { IMPORT_BATCH_SIZE, parseAndValidate, importInBatches } from "../lib/bulkImport.js";
import {
  useBulkCreateManualContacts, useUpdateManualContact, useAllManualContactPhones,
} from "../hooks/useManualContacts.js";
import { useBulkCreateMembers, useUpdateMember, useAllMemberContacts } from "../hooks/useMembers.js";

const SMALL_BTN = { fontSize: 12.5, height: 30, padding: "0 10px" };

// One summary audit_logs entry per bulk action, on top of whichever
// per-row triggers already fire (manual_contacts has one; members
// doesn't). Reuses the existing log_audit_event() SQL function
// (0001_foundation.sql) via RPC — no new migration needed.
async function logBulkAudit(action, table, details) {
  try {
    await supabase.rpc("log_audit_event", {
      p_action: action, p_target_table: table, p_target_id: null,
      p_before: null, p_after: details,
    });
  } catch {
    // Audit logging is best-effort from the client — never block a
    // completed import/export on it.
  }
}

// Shared by both Members and Messages' Manual Contacts — one generic
// engine driven by lib/importTargets.js's per-table config, instead of a
// parallel modal per table. `allowedTargets` is a subset of
// Object.keys(IMPORT_TARGETS) the current role/page may write to.
export function CsvImportModal({ allowedTargets, ministries, onClose }) {
  const [targetKey, setTargetKey] = useState(allowedTargets[0]);
  const target = IMPORT_TARGETS[targetKey];

  const bulkCreateManualContacts = useBulkCreateManualContacts();
  const bulkCreateMembers = useBulkCreateMembers();
  const updateManualContact = useUpdateManualContact();
  const updateMember = useUpdateMember();
  const { data: existingManualPhones } = useAllManualContactPhones();
  const { data: existingMemberContacts } = useAllMemberContacts();

  const hooks = targetKey === "manualContacts"
    ? {
        bulkInsert: (rows) => bulkCreateManualContacts.mutateAsync(rows),
        update: (id, row) => updateManualContact.mutateAsync({ id, fullName: row.fullName, phone: row.phone, email: row.email, groupLabel: row.groupLabel, notes: row.notes }),
      }
    : {
        bulkInsert: (rows) => bulkCreateMembers.mutateAsync(rows),
        update: (id, row) => { const { ministryIds, ...patch } = row; return updateMember.mutateAsync({ id, ...patch }); },
      };
  const existingMap = targetKey === "manualContacts"
    ? new Map((existingManualPhones ?? []).map((c) => [c.phone, c.id]))
    : new Map((existingMemberContacts ?? []).map((m) => [m.contact, m.id]));
  const ctx = { ministries: ministries ?? [] };

  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState("upload"); // upload | preview | importing | done
  const [parsed, setParsed] = useState(null);
  const [duplicateChoice, setDuplicateChoice] = useState("skip"); // skip | update
  const [showErrors, setShowErrors] = useState(false);
  const [showFailed, setShowFailed] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRawText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const onDownloadTemplate = () => {
    const cols = target.templateColumns.map((c) => ({ key: c, label: c }));
    downloadCsv(`${target.table}-template.csv`, toCsv([target.templateExample], cols));
  };

  const onPreview = () => {
    setError(null);
    if (!rawText.trim()) return setError("Choose a CSV file first.");
    const result = parseAndValidate(rawText, target, ctx, existingMap);
    if (result.total === 0) return setError("That file doesn't have any data rows.");
    setParsed(result);
    setStep("preview");
  };

  const onImport = async () => {
    setError(null);
    setStep("importing");
    setProgress({ done: 0, total: parsed.valid.length });

    const { imported, failedRows } = await importInBatches(
      parsed.valid, IMPORT_BATCH_SIZE, hooks.bulkInsert,
      (done, total) => setProgress({ done, total })
    );

    let updated = 0;
    const updateFailed = [];
    let skippedDuplicates = parsed.duplicates.length;
    if (duplicateChoice === "update") {
      skippedDuplicates = 0;
      for (const dup of parsed.duplicates) {
        if (dup.existingId == null) { skippedDuplicates++; continue; } // in-file repeat, nothing to update
        try {
          await hooks.update(dup.existingId, dup.row);
          updated++;
        } catch (err) {
          updateFailed.push({ rowNumber: dup.rowNumber, error: err?.message || "Update failed" });
        }
      }
    }

    const finalSummary = {
      total: parsed.total,
      imported: imported + updated,
      skipped: parsed.invalid.length + skippedDuplicates,
      failed: failedRows.length + updateFailed.length,
      failedRows: [...failedRows, ...updateFailed],
    };
    setSummary(finalSummary);
    setStep("done");
    logBulkAudit("bulk_import", target.table, {
      imported: finalSummary.imported, skipped: finalSummary.skipped, failed: finalSummary.failed,
    });
  };

  return (
    <Modal onClose={step === "importing" ? () => {} : onClose}>
      <div className="glass" style={{ width: "100%", maxWidth: 560, padding: 26, maxHeight: "86vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>Import {target.label} (CSV)</h2>
          {step !== "importing" && <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>}
        </div>

        {step === "upload" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
            {allowedTargets.length > 1 && (
              <div className="field">
                <label>Import into</label>
                <select className="select" value={targetKey} onChange={(e) => { setTargetKey(e.target.value); setRawText(""); setParsed(null); }}>
                  {allowedTargets.map((t) => <option key={t} value={t}>{IMPORT_TARGETS[t].label}</option>)}
                </select>
              </div>
            )}
            <p className="muted" style={{ fontSize: 12.5 }}>
              Columns: {target.templateColumns.join(", ")}.
            </p>
            <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={onDownloadTemplate}>
              <Icon name="download" size={13} /> Download Template
            </button>
            <div className="field">
              <label>Upload CSV file</label>
              <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
            </div>
            <textarea className="textarea" rows={5} placeholder="…or paste CSV rows here" value={rawText} onChange={(e) => setRawText(e.target.value)} />
          </div>
        )}

        {step === "preview" && parsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
            <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
              <div><div className="muted" style={{ fontSize: 11.5 }}>Total Rows</div><div style={{ fontSize: 18, fontWeight: 600 }}>{parsed.total}</div></div>
              <div><div className="muted" style={{ fontSize: 11.5 }}>Valid Rows</div><div style={{ fontSize: 18, fontWeight: 600, color: "var(--green-500, #2fae5a)" }}>{parsed.valid.length}</div></div>
              <div><div className="muted" style={{ fontSize: 11.5 }}>Invalid Rows</div><div style={{ fontSize: 18, fontWeight: 600 }}>{parsed.invalid.length}</div></div>
              <div><div className="muted" style={{ fontSize: 11.5 }}>Possible Duplicates</div><div style={{ fontSize: 18, fontWeight: 600 }}>{parsed.duplicates.length}</div></div>
            </div>

            {parsed.invalid.length > 0 && (
              <div>
                <button className="btn btn-ghost" style={SMALL_BTN} onClick={() => setShowErrors((s) => !s)}>
                  {showErrors ? "Hide" : "View"} Errors ({parsed.invalid.length})
                </button>
                {showErrors && (
                  <div className="glass-soft" style={{ marginTop: 8, padding: 10, maxHeight: 160, overflowY: "auto", fontSize: 12.5 }}>
                    {parsed.invalid.map((r) => (
                      <div key={r.rowNumber} style={{ marginBottom: 6 }}>
                        <strong>Row {r.rowNumber}</strong> — {r.errors.join("; ")}
                      </div>
                    ))}
                  </div>
                )}
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Invalid rows are skipped automatically — only valid rows are imported.</div>
              </div>
            )}

            {parsed.duplicates.length > 0 && (
              <div className="glass-soft" style={{ padding: 12 }}>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>Duplicate records detected.</div>
                <label className="row" style={{ gap: 8, fontSize: 13, marginBottom: 6, cursor: "pointer" }}>
                  <input type="radio" name="dupChoice" checked={duplicateChoice === "skip"} onChange={() => setDuplicateChoice("skip")} /> Skip duplicates
                </label>
                <label className="row" style={{ gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" name="dupChoice" checked={duplicateChoice === "update"} onChange={() => setDuplicateChoice("update")} /> Update existing records
                </label>
              </div>
            )}
          </div>
        )}

        {step === "importing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", padding: "20px 0" }}>
            <p className="muted" style={{ fontSize: 13 }}>Importing {target.label.toLowerCase()}…</p>
            <div style={{ width: "100%", height: 8, borderRadius: 4, background: "var(--bg-2)", overflow: "hidden" }}>
              <div style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`, height: "100%", background: "var(--gold-500)", transition: "width 0.2s" }} />
            </div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              {progress.done} / {progress.total} — {progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%
            </div>
          </div>
        )}

        {step === "done" && summary && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
            <h3 style={{ fontSize: 16 }}>Import Completed</h3>
            <p className="muted" style={{ fontSize: 13 }}>{summary.total} rows processed</p>
            <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
              <span className="badge badge-green">{summary.imported} imported</span>
              <span className="badge badge-gold">{summary.skipped} skipped</span>
              <span className="badge badge-red">{summary.failed} failed</span>
            </div>
            {summary.failedRows.length > 0 && (
              <div>
                <button className="btn btn-ghost" style={SMALL_BTN} onClick={() => setShowFailed((s) => !s)}>
                  {showFailed ? "Hide" : "View"} Failed Rows ({summary.failedRows.length})
                </button>
                {showFailed && (
                  <div className="glass-soft" style={{ marginTop: 8, padding: 10, maxHeight: 160, overflowY: "auto", fontSize: 12.5 }}>
                    {summary.failedRows.map((r) => (
                      <div key={r.rowNumber} style={{ marginBottom: 6 }}><strong>Row {r.rowNumber}</strong> — {r.error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && <div className="badge badge-red" style={{ display: "block", marginTop: 14, padding: "8px 12px" }}>{error}</div>}

        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          {step === "upload" && (
            <>
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={onPreview}>Continue</button>
            </>
          )}
          {step === "preview" && (
            <>
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={onImport} disabled={parsed.valid.length === 0 && !(duplicateChoice === "update" && parsed.duplicates.some((d) => d.existingId))}>
                Import {parsed.valid.length + (duplicateChoice === "update" ? parsed.duplicates.filter((d) => d.existingId).length : 0)} Record{parsed.valid.length === 1 ? "" : "s"}
              </button>
            </>
          )}
          {step === "done" && <button className="btn btn-primary" onClick={onClose}>Done</button>}
        </div>
      </div>
    </Modal>
  );
}

export function ExportCsvModal({ allowedTargets, filteredMembers, filteredManualContacts, selectedMembers, selectedManualContacts, allowSelected = true, onClose }) {
  const [targetKey, setTargetKey] = useState(allowedTargets[0]);
  const [scope, setScope] = useState("all"); // all | filtered | selected
  const [exporting, setExporting] = useState(false);
  const target = IMPORT_TARGETS[targetKey];

  const onExport = async () => {
    setExporting(true);
    try {
      let records;
      if (scope === "all") {
        const { data, error } = await supabase.from(target.table).select("*");
        if (error) throw error;
        records = data ?? [];
      } else if (scope === "filtered") {
        records = targetKey === "manualContacts" ? filteredManualContacts : filteredMembers;
      } else {
        records = targetKey === "manualContacts" ? selectedManualContacts : selectedMembers;
      }
      if (target.deriveExportRow) records = records.map(target.deriveExportRow);
      const csv = toCsv(records, target.exportColumns);
      downloadCsv(`${target.table}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      await logBulkAudit("bulk_export", target.table, { count: records.length, scope });
      onClose();
    } catch (err) {
      // exporting is entirely local/read-only — an error here is just
      // shown inline, nothing was written that needs to be reported failed
      alert(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="glass modal-card" style={{ maxWidth: 420, padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}>Export {target.label}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {allowedTargets.length > 1 && (
            <div className="field">
              <label>Export from</label>
              <select className="select" value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
                {allowedTargets.map((t) => <option key={t} value={t}>{IMPORT_TARGETS[t].label}</option>)}
              </select>
            </div>
          )}
          <label className="row" style={{ gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="radio" name="exportScope" checked={scope === "all"} onChange={() => setScope("all")} /> All {target.label.toLowerCase()}
          </label>
          <label className="row" style={{ gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="radio" name="exportScope" checked={scope === "filtered"} onChange={() => setScope("filtered")} /> Current filtered results
          </label>
          {allowSelected && (
            <label className="row" style={{ gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="radio" name="exportScope" checked={scope === "selected"} onChange={() => setScope("selected")} /> Selected only
            </label>
          )}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onExport} disabled={exporting}>{exporting ? "Exporting…" : "Export"}</button>
        </div>
      </div>
    </Modal>
  );
}
