import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

const PASTORAL_CARE_TABLES = ["life_events", "member_support", "souls_won", "water_baptisms", "holy_spirit_baptisms"];

describe("Phase 6 Pastoral Care RLS policies (static)", () => {
  let sql;
  beforeAll(() => { sql = allMigrationSql(); });

  it("every pastoral care table has row level security enabled", () => {
    for (const table of PASTORAL_CARE_TABLES) {
      expect(sql).toMatch(new RegExp(`alter table ${table} enable row level security`));
    }
  });

  for (const table of PASTORAL_CARE_TABLES) {
    it(`${table}: select allows super_admin/pastor/secretary, nothing else`, () => {
      const body = policyBody(sql, `${table}_select`);
      expect(body).toContain("'super_admin'");
      expect(body).toContain("'pastor'");
      expect(body).toContain("'secretary'");
      expect(body).not.toContain("'ministry_leader'");
      expect(body).not.toContain("'comms_media'");
      expect(body).not.toContain("'finance'");
    });

    it(`${table}: write restricted to super_admin/pastor — NOT secretary (view-only per spec)`, () => {
      const body = policyBody(sql, `${table}_write`);
      expect(body).toContain("'super_admin'");
      expect(body).toContain("'pastor'");
      expect(body).not.toContain("'secretary'");
      expect(body).not.toContain("'ministry_leader'");
      expect(body).not.toContain("'comms_media'");
      expect(body).not.toContain("'finance'");
    });
  }

  describe("life_events.names_child_parents_bereaved (0017) — additive only", () => {
    it("adds the new column via ADD COLUMN", () => {
      expect(sql).toMatch(/alter table life_events add column names_child_parents_bereaved text/);
    });

    it("never renames or drops life_events.names — existing Life Event data must stay intact", () => {
      expect(sql).not.toMatch(/alter table life_events\s+rename column names/i);
      expect(sql).not.toMatch(/alter table life_events\s+drop column names\b/i);
    });
  });
});
