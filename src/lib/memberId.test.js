import { describe, it, expect } from "vitest";
import { formatMemberId } from "./memberId.js";

describe("formatMemberId", () => {
  it("formats as PIWC-{year}-{4-digit zero-padded}", () => {
    expect(formatMemberId(2026, 389)).toBe("PIWC-2026-0389");
    expect(formatMemberId(2026, 21)).toBe("PIWC-2026-0021");
    expect(formatMemberId(2026, 1)).toBe("PIWC-2026-0001");
  });

  it("grows past 4 digits instead of truncating once the sequence exceeds 9999", () => {
    expect(formatMemberId(2027, 12345)).toBe("PIWC-2027-12345");
  });

  it("matches the real production sample IDs given in the spec", () => {
    const samples = [21, 59, 199, 208, 218, 235, 297, 389];
    const ids = samples.map((n) => formatMemberId(2026, n));
    expect(ids).toEqual([
      "PIWC-2026-0021", "PIWC-2026-0059", "PIWC-2026-0199", "PIWC-2026-0208",
      "PIWC-2026-0218", "PIWC-2026-0235", "PIWC-2026-0297", "PIWC-2026-0389",
    ]);
  });
});

describe("bulk import spanning multiple join-years", () => {
  // Simulates what the SQL sequence guarantees: nextval() hands out a
  // strictly increasing counter regardless of what order rows with
  // different date_joined years happen to be inserted in. A bulk CSV
  // import mixing 2024/2025/2026 joiners still gets globally unique,
  // monotonically increasing suffixes — the year in the id is purely a
  // label, never a reset point.
  it("produces globally unique, monotonically increasing suffixes regardless of interleaved years", () => {
    const rows = [
      { year: 2024 }, { year: 2026 }, { year: 2025 }, { year: 2026 },
      { year: 2024 }, { year: 2026 }, { year: 2025 }, { year: 2026 },
    ];
    let seq = 1;
    const ids = rows.map((r) => formatMemberId(r.year, seq++));

    const suffixes = ids.map((id) => Number(id.split("-")[2]));
    expect(new Set(suffixes).size).toBe(suffixes.length); // all unique
    for (let i = 1; i < suffixes.length; i++) {
      expect(suffixes[i]).toBeGreaterThan(suffixes[i - 1]); // strictly increasing
    }
    // The years themselves are NOT sorted/reset — proving the counter
    // doesn't restart per year even though the label does vary.
    expect(ids).toEqual([
      "PIWC-2024-0001", "PIWC-2026-0002", "PIWC-2025-0003", "PIWC-2026-0004",
      "PIWC-2024-0005", "PIWC-2026-0006", "PIWC-2025-0007", "PIWC-2026-0008",
    ]);
  });

  it("continuing the sequence for a later batch never collides with an earlier one", () => {
    const batch1 = [1, 2, 3].map((n) => formatMemberId(2025, n));
    const nextSeq = 4; // where a second, later import would resume from
    const batch2 = [nextSeq, nextSeq + 1].map((n) => formatMemberId(2026, n));
    const all = [...batch1, ...batch2];
    expect(new Set(all).size).toBe(all.length);
  });
});
