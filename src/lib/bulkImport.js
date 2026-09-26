// Orchestration for the CSV import pipeline (parse -> validate -> dedupe
// -> batch-insert-with-fallback) — pulled out of MessagesPage.jsx so it's
// independently unit-testable, same reasoning as lib/finance.js and
// lib/sms.js keeping pure logic out of the component tree.
import { parseCsvObjects } from "./csv.js";

export const IMPORT_BATCH_SIZE = 500;

// Maps a CSV header cell to a target's canonical field key, accepting
// either the import template's own column name ("preferred_assembly") or
// the export's friendly label ("Preferred Assembly") — case-insensitive.
// Without this, a file round-tripped through Export CSV -> edit -> Import
// CSV wouldn't actually populate anything: exportColumns uses Title Case
// labels while templateColumns/validateRow expect the raw snake_case
// keys, so the header row would never match. Anything that matches
// neither (e.g. a computed, non-importable export column like "Age
// Bracket") just passes through unmapped and is silently ignored by
// validateRow, same as any other unrecognized column.
function headerKeyMap(target) {
  const map = new Map();
  for (const key of target.templateColumns) map.set(key.toLowerCase(), key);
  for (const col of target.exportColumns ?? []) {
    if (!map.has(col.label.toLowerCase())) map.set(col.label.toLowerCase(), col.key);
  }
  return map;
}

function normalizeHeaders(records, target) {
  const map = headerKeyMap(target);
  return records.map((raw) => {
    const normalized = {};
    for (const [header, value] of Object.entries(raw)) {
      normalized[map.get(header.trim().toLowerCase()) ?? header] = value;
    }
    return normalized;
  });
}

/**
 * Parses CSV text against a target's validateRow(raw, ctx) and an
 * existingMap (duplicateValue -> existing record id) to sort every row
 * into valid / duplicate / invalid buckets.
 */
export function parseAndValidate(text, target, ctx, existingMap) {
  const { records: rawRecords } = parseCsvObjects(text);
  const records = normalizeHeaders(rawRecords, target);
  const seenInFile = new Set();
  const valid = [];
  const duplicates = [];
  const invalid = [];
  records.forEach((raw, i) => {
    const rowNumber = i + 2; // header is row 1
    const result = target.validateRow(raw, ctx);
    if (!result.ok) {
      invalid.push({ rowNumber, raw, errors: result.errors });
      return;
    }
    const dupVal = result.duplicateValue;
    const existingId = dupVal ? existingMap.get(dupVal) : undefined;
    const isDup = Boolean(dupVal) && (existingId !== undefined || seenInFile.has(dupVal));
    if (dupVal) seenInFile.add(dupVal);
    const entry = { rowNumber, raw, row: result.row, warnings: result.warnings };
    if (isDup) duplicates.push({ ...entry, existingId: existingId ?? null });
    else valid.push(entry);
  });
  return { valid, duplicates, invalid, total: records.length };
}

/**
 * Inserts `items` (each {rowNumber, row}) in batches via bulkInsert(rows).
 * If a batch's insert call throws (e.g. a duplicate created elsewhere
 * mid-import), retries that batch's rows one at a time so a single bad
 * row can't sink the rest — reports exactly which rows actually failed
 * rather than a blanket success/failure for the whole batch.
 */
export async function importInBatches(items, batchSize, bulkInsert, onProgress) {
  let imported = 0;
  const failedRows = [];
  let done = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    try {
      await bulkInsert(batch.map((b) => b.row));
      imported += batch.length;
    } catch {
      for (const item of batch) {
        try {
          await bulkInsert([item.row]);
          imported++;
        } catch (rowErr) {
          failedRows.push({ rowNumber: item.rowNumber, error: rowErr?.message || "Insert failed" });
        }
      }
    }
    done += batch.length;
    onProgress?.(done, items.length);
  }
  return { imported, failedRows };
}
