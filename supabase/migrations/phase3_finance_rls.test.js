import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Same static-check approach as phase2_rls.test.js — proves the SQL says
// what the spec's Finance matrix row says (Super Admin: Full, Pastor:
// View, Finance: Full, everyone else: nothing), not that Postgres
// actually enforces it live. See the Phase 2 summary for why: Vitest has
// no live Postgres to run real RLS against.

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

const FINANCE_TABLES = [
  "net_tithes_performance",
  "missions_offering_performance",
  "designated_funds",
  "designated_fund_weekly",
  "tithe_and_mo",
];

describe("Phase 3 Finance RLS policies (static)", () => {
  let sql;
  beforeAll(() => { sql = allMigrationSql(); });

  it("every finance table has row level security enabled", () => {
    for (const table of FINANCE_TABLES) {
      expect(sql).toMatch(new RegExp(`alter table ${table} enable row level security`));
    }
  });

  for (const table of FINANCE_TABLES) {
    it(`${table}: select allows super_admin/pastor/finance, nothing else`, () => {
      const body = policyBody(sql, `${table}_select`);
      expect(body).toContain("'super_admin'");
      expect(body).toContain("'pastor'");
      expect(body).toContain("'finance'");
      expect(body).not.toContain("'secretary'");
      expect(body).not.toContain("'ministry_leader'");
      expect(body).not.toContain("'comms_media'");
    });

    it(`${table}: write allows super_admin/finance only — NOT pastor (view-only per spec)`, () => {
      const body = policyBody(sql, `${table}_write`);
      expect(body).toContain("'super_admin'");
      expect(body).toContain("'finance'");
      expect(body).not.toContain("'pastor'");
      expect(body).not.toContain("'secretary'");
      expect(body).not.toContain("'ministry_leader'");
      expect(body).not.toContain("'comms_media'");
    });
  }
});
