import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "EditMemberModal.jsx"), "utf8");

describe("EditMemberModal.jsx (static)", () => {
  it("MARITAL_STATUSES includes Child and Toddler alongside the original six values", () => {
    const match = source.match(/const MARITAL_STATUSES = \[([^\]]*)\];/);
    expect(match).toBeTruthy();
    const values = match[1].split(",").map((s) => s.trim().replace(/"/g, ""));
    expect(values).toEqual(["Single", "Married", "Divorced", "Widowed", "Engaged", "Separated", "Child", "Toddler"]);
  });

  it("keeps the blank/default marital status option", () => {
    expect(source).toMatch(/<option value="">Not specified<\/option>/);
  });

  it("keeps Status as an editable field here even though it's not a Members table column", () => {
    expect(source).toMatch(/<label>Status<\/label>/);
    expect(source).toMatch(/value=\{form\.status\}/);
  });
});
