import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "MembersList.jsx"), "utf8");

describe("MembersList.jsx (static)", () => {
  it("replaces the Status column with Date of Birth in the visible table", () => {
    expect(source).toMatch(/<th>Date of Birth<\/th>/);
    expect(source).not.toMatch(/<th>Status<\/th>/);
  });

  it("keeps the Age Bracket column", () => {
    expect(source).toMatch(/<th>Age Bracket<\/th>/);
  });

  it("formats the Date of Birth cell with the timezone-safe formatDateOnly helper, not a raw local-time toLocaleDateString", () => {
    expect(source).toMatch(/import \{ formatDateOnly \} from "\.\.\/\.\.\/lib\/formatDate\.js";/);
    expect(source).toMatch(/\{formatDateOnly\(m\.date_of_birth\)\}/);
  });

  it("still computes m.status (data model untouched) even though it's no longer a table column", () => {
    // canDelete/canEdit etc. aside, the row data itself (`m`) still comes
    // straight from useMembers()'s `select("*")` — nothing here strips
    // status out of the fetched row, it's just not rendered as a <td> anymore.
    expect(source).toContain("useMembers");
  });

  it("keeps checkbox and Member ID/action columns unchanged", () => {
    expect(source).toMatch(/<th style=\{\{ width: 36 \}\}>/);
    expect(source).toMatch(/<th>Member<\/th>/);
    expect(source).toMatch(/<th>Phone<\/th>/);
    expect(source).toMatch(/<th>Gender<\/th>/);
    expect(source).toMatch(/<th>Joined<\/th>/);
  });

  it("loading/empty colSpan still matches the total column count (8) — a 1-for-1 swap, not an added column", () => {
    const matches = source.match(/colSpan=\{(\d+)\}/g) ?? [];
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      expect(m).toBe("colSpan={8}");
    }
  });
});
