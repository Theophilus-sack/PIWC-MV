// Generic CSV parse/serialize helpers — pulled out of MessagesPage.jsx's
// old inline `line.split(",")` (which broke on any quoted comma, e.g. an
// address like "Accra, Ghana") and `csvEscape`/`exportContactsCsv`, so
// both import (Members + Manual Contacts) and export share one real,
// RFC4180-ish implementation instead of each page reinventing it.

/**
 * Parses CSV text into an array of row arrays (raw strings, not yet
 * mapped to columns). Handles quoted fields, embedded commas, embedded
 * newlines inside quotes, and doubled "" as an escaped quote.
 */
export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, ""); // strip BOM if present (our own exports add one)

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Parses CSV text with a header row into an array of {column: value} objects. */
export function parseCsvObjects(text) {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]))
  );
  return { headers, records };
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Wraps a phone-number-looking value as ="..." — the standard trick for
// forcing Excel to treat a numeric-looking cell as text instead of
// silently converting it to scientific notation.
function csvPhoneCell(v) {
  const s = String(v ?? "");
  if (!s) return "";
  return `="${s.replace(/"/g, '""')}"`;
}

/**
 * Serializes rows of {column: value} objects into CSV text.
 * `columns` is an ordered [{key, label, isPhone}] list — label becomes
 * the header, isPhone routes that column through csvPhoneCell.
 */
export function toCsv(records, columns) {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const lines = records.map((r) =>
    columns.map((c) => (c.isPhone ? csvPhoneCell(r[c.key]) : csvEscape(r[c.key]))).join(",")
  );
  return [header, ...lines].join("\r\n");
}

/** Triggers a browser download of CSV text, UTF-8 BOM-prefixed for Excel. */
export function downloadCsv(filename, csvText) {
  const blob = new Blob(["﻿" + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
