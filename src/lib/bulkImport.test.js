import { describe, it, expect, vi } from "vitest";
import { parseAndValidate, importInBatches } from "./bulkImport.js";
import { IMPORT_TARGETS } from "./importTargets.js";
import { toCsv } from "./csv.js";

describe("parseAndValidate", () => {
  const target = IMPORT_TARGETS.manualContacts;
  const csv = [
    "full_name,phone,email,group_label,notes",
    "Kwame Mensah,0241234567,kwame@example.com,Youth,",
    "Ama Boateng,024ABC123,,,", // invalid phone
    "Kofi Owusu,0551234567,,,", // will collide with an "existing" record below
    "Yaw Asante,0241234567,,,", // duplicates the first row within the same file
  ].join("\n");

  it("sorts rows into valid/invalid/duplicate buckets", () => {
    const existingMap = new Map([["233551234567", "existing-id-1"]]); // Kofi's number already exists
    const result = parseAndValidate(csv, target, {}, existingMap);

    expect(result.total).toBe(4);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].rowNumber).toBe(3); // header=1, so row 3 is "Ama Boateng"
    expect(result.invalid[0].errors).toContain("Invalid phone number");

    expect(result.duplicates).toHaveLength(2);
    const kofi = result.duplicates.find((d) => d.raw.full_name === "Kofi Owusu");
    expect(kofi.existingId).toBe("existing-id-1");
    const yaw = result.duplicates.find((d) => d.raw.full_name === "Yaw Asante");
    expect(yaw.existingId).toBeNull(); // duplicate of an earlier row in this same file, not an existing DB record

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].raw.full_name).toBe("Kwame Mensah");
  });

  it("returns everything valid when there's nothing to conflict with", () => {
    const result = parseAndValidate("full_name,phone\nKwame,0241234567", target, {}, new Map());
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
  });
});

describe("CSV round-trip (Export CSV -> edit -> Import CSV)", () => {
  // Export uses friendly Title Case labels ("Preferred Assembly"); the
  // import template/validateRow expect raw snake_case keys
  // ("preferred_assembly"). Without header normalization in
  // parseAndValidate, re-uploading an exported file would populate
  // nothing — every raw.<key> would be undefined.
  it("a Members export re-imports as the same data for every importable field", () => {
    const target = IMPORT_TARGETS.members;
    const dbRow = {
      id: "abc-123",
      member_id: "PIWC-2026-0389", // server-generated — must NOT survive re-import
      name: "Ama Boateng",
      gender: "Female",
      contact: "233241234567",
      whatsapp_number: "233551234567",
      residence: "Adenta",
      preferred_assembly: "English",
      status: "stay",
      nationality: "Nigeria",
      marital_status: "Single",
      date_of_birth: "1990-05-15",
      date_joined: "2026-01-15",
      visiting_from: null,
      educational_professional_background: "Accountant",
      educational_institution: "University of Ghana",
      workplace_name: "Ghana Revenue Authority",
    };
    const exported = target.deriveExportRow(dbRow);
    const csv = toCsv([exported], target.exportColumns);

    const result = parseAndValidate(csv, target, { ministries: [] }, new Map());
    expect(result.invalid).toEqual([]);
    expect(result.valid).toHaveLength(1);

    const { row } = result.valid[0];
    expect(row.name).toBe(dbRow.name);
    expect(row.gender).toBe(dbRow.gender);
    expect(row.contact).toBe(dbRow.contact);
    expect(row.whatsapp_number).toBe(dbRow.whatsapp_number);
    expect(row.residence).toBe(dbRow.residence);
    expect(row.preferred_assembly).toBe(dbRow.preferred_assembly);
    expect(row.status).toBe(dbRow.status);
    expect(row.nationality).toBe(dbRow.nationality);
    expect(row.marital_status).toBe(dbRow.marital_status);
    expect(row.date_of_birth).toBe(dbRow.date_of_birth);
    expect(row.date_joined).toBe(dbRow.date_joined);
    expect(row.educational_professional_background).toBe(dbRow.educational_professional_background);
    expect(row.educational_institution).toBe(dbRow.educational_institution);
    expect(row.workplace_name).toBe(dbRow.workplace_name);

    // member_id round-trips as-is (it's a validly formatted, pre-assigned
    // id — the historical-backfill path) since 0021; age_bracket is
    // computed, not a real column, and stays excluded from re-import.
    expect(row.member_id).toBe(dbRow.member_id);
    expect(row.age_bracket).toBeUndefined();
  });

  it("a Manual Contacts export re-imports as the same data", () => {
    const target = IMPORT_TARGETS.manualContacts;
    const dbRow = { full_name: "Kwame Mensah", phone: "233241234567", email: "kwame@example.com", group_label: "Youth", notes: "VIP" };
    const csv = toCsv([dbRow], target.exportColumns);

    const result = parseAndValidate(csv, target, {}, new Map());
    expect(result.valid).toHaveLength(1);
    const { row } = result.valid[0];
    expect(row.fullName).toBe(dbRow.full_name);
    expect(row.phone).toBe(dbRow.phone);
    expect(row.email).toBe(dbRow.email);
    expect(row.groupLabel).toBe(dbRow.group_label);
    expect(row.notes).toBe(dbRow.notes);
  });

  it("also accepts the raw template header names directly (not just export labels)", () => {
    const target = IMPORT_TARGETS.members;
    const csv = "name,preferred_assembly\nAma Boateng,English";
    const result = parseAndValidate(csv, target, { ministries: [] }, new Map());
    expect(result.valid[0].row.preferred_assembly).toBe("English");
  });
});

describe("importInBatches", () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ rowNumber: i + 2, row: { n: i } }));

  it("calls bulkInsert once per batch when nothing fails", async () => {
    const bulkInsert = vi.fn().mockResolvedValue();
    const onProgress = vi.fn();
    const { imported, failedRows } = await importInBatches(items, 5, bulkInsert, onProgress);

    expect(imported).toBe(12);
    expect(failedRows).toEqual([]);
    expect(bulkInsert).toHaveBeenCalledTimes(3); // batches of 5, 5, 2
    expect(onProgress).toHaveBeenLastCalledWith(12, 12);
  });

  it("falls back to one-row-at-a-time when a batch insert throws, isolating the bad row", async () => {
    const bulkInsert = vi.fn((rows) => {
      if (rows.length > 1) throw new Error("batch failed");
      if (rows[0].n === 2) throw new Error("this row is bad");
      return Promise.resolve();
    });
    const { imported, failedRows } = await importInBatches(items.slice(0, 5), 5, bulkInsert, () => {});

    expect(imported).toBe(4); // 5 rows, 1 fails
    expect(failedRows).toHaveLength(1);
    expect(failedRows[0].rowNumber).toBe(4); // items[2].rowNumber = 2+2 = 4
    expect(failedRows[0].error).toBe("this row is bad");
  });

  it("reports progress incrementally as batches complete", async () => {
    const calls = [];
    await importInBatches(items, 5, vi.fn().mockResolvedValue(), (done, total) => calls.push([done, total]));
    expect(calls).toEqual([[5, 12], [10, 12], [12, 12]]);
  });
});
