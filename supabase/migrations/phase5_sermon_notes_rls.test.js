import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Same static-check approach as phase2/3/4 — but the thing this file
// exists specifically to catch is the one easy mistake called out in the
// build plan: "helpfully" granting Super Admin a carve-out here. The spec
// is literal — Sermon/Word Prep is Pastor-exclusive, Super Admin gets
// nothing, unlike every other module.

const migrationsDir = dirname(fileURLToPath(import.meta.url));

function allMigrationSql() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
    .join("\n\n");
}

function policyBody(sql, policyName) {
  const pattern = new RegExp(
    `create policy ${policyName}[\\s\\S]*?(?=create policy |create (?:table|view|function|trigger)|$)`,
    "g"
  );
  const matches = sql.match(pattern);
  if (!matches?.length) throw new Error(`policy ${policyName} not found`);
  return matches[matches.length - 1];
}

describe("Phase 5 sermon_notes RLS policies (static)", () => {
  let sql;
  beforeAll(() => { sql = allMigrationSql(); });

  it("sermon_notes has row level security enabled", () => {
    expect(sql).toMatch(/alter table sermon_notes enable row level security/);
  });

  for (const policy of ["sermon_notes_select", "sermon_notes_write"]) {
    it(`${policy}: scoped to pastor + pastor_id = auth.uid() — no other role, especially not super_admin`, () => {
      const body = policyBody(sql, policy);
      expect(body).toContain("'pastor'");
      expect(body).toContain("pastor_id = auth.uid()");
      expect(body).not.toContain("'super_admin'");
      expect(body).not.toContain("'secretary'");
      expect(body).not.toContain("'ministry_leader'");
      expect(body).not.toContain("'comms_media'");
      expect(body).not.toContain("'finance'");
    });
  }

  it("no policy anywhere grants blanket select access to sermon_notes (e.g. auth.uid() is not null)", () => {
    const selectBody = policyBody(sql, "sermon_notes_select");
    expect(selectBody).not.toMatch(/auth\.uid\(\)\s+is\s+not\s+null/);
  });
});
