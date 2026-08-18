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

describe("Phase 6 Reports RLS policies (static)", () => {
  let sql;
  beforeAll(() => { sql = allMigrationSql(); });

  it("comparative_stats has row level security enabled", () => {
    expect(sql).toMatch(/alter table comparative_stats enable row level security/);
  });

  it("select is open to any authenticated user (every role has some reports access per the matrix)", () => {
    const body = policyBody(sql, "comparative_stats_select");
    expect(body.trim()).toMatch(/using\s*\(\s*auth\.uid\(\)\s+is\s+not\s+null\s*\)/);
  });

  it("write restricted to super_admin/pastor only", () => {
    const body = policyBody(sql, "comparative_stats_write");
    expect(body).toContain("'super_admin'");
    expect(body).toContain("'pastor'");
    expect(body).not.toContain("'secretary'");
    expect(body).not.toContain("'ministry_leader'");
    expect(body).not.toContain("'comms_media'");
    expect(body).not.toContain("'finance'");
  });
});
