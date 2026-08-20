import { describe, it, expect, vi } from "vitest";
import { parseAndValidate, importInBatches } from "./bulkImport.js";
import { IMPORT_TARGETS } from "./importTargets.js";

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
