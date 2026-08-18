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

const MINISTRY_SCOPED_TABLES = ["events", "activities", "other_activities"];
const GENERAL_TABLES = ["minutes", "convention_attendance"];

describe("Phase 6 Events RLS policies (static)", () => {
  let sql;
  beforeAll(() => { sql = allMigrationSql(); });

  it("every events-module table has row level security enabled", () => {
    for (const table of [...MINISTRY_SCOPED_TABLES, ...GENERAL_TABLES]) {
      expect(sql).toMatch(new RegExp(`alter table ${table} enable row level security`));
    }
  });

  for (const table of MINISTRY_SCOPED_TABLES) {
    it(`${table}: select/insert — super_admin/pastor/comms_media unrestricted, ministry_leader scoped to own ministry, secretary scoped to general only`, () => {
      for (const policy of [`${table}_select`, `${table}_insert`]) {
        const body = policyBody(sql, policy);
        expect(body).toContain("'super_admin'");
        expect(body).toContain("'pastor'");
        expect(body).toContain("'comms_media'");
        expect(body).toMatch(/'ministry_leader'[\s\S]*?current_ministry_id\(\)/);
        expect(body).toMatch(/'secretary'[\s\S]*?ministry_id is null/);
        expect(body).not.toContain("'finance'");
      }
    });

    it(`${table}: delete excludes secretary (log tier doesn't include delete, matching service_dates_delete precedent)`, () => {
      const body = policyBody(sql, `${table}_delete`);
      expect(body).toContain("'super_admin'");
      expect(body).not.toContain("'secretary'");
    });
  }

  for (const table of GENERAL_TABLES) {
    it(`${table}: no ministry concept — ministry_leader excluded entirely, everyone else with events access included`, () => {
      const body = policyBody(sql, `${table}_write`);
      expect(body).toContain("'super_admin'");
      expect(body).toContain("'pastor'");
      expect(body).toContain("'comms_media'");
      expect(body).toContain("'secretary'");
      expect(body).not.toContain("'ministry_leader'");
      expect(body).not.toContain("'finance'");
    });
  }
});
