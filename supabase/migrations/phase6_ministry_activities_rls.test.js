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

describe("Phase 6 ministry_activities RLS policies (static)", () => {
  let sql;
  beforeAll(() => { sql = allMigrationSql(); });

  it("ministry_activities has row level security enabled", () => {
    expect(sql).toMatch(/alter table ministry_activities enable row level security/);
  });

  it("select allows super_admin/pastor/secretary fully, ministry_leader only via own ministry — comms_media/finance excluded (no Groups access per matrix)", () => {
    const body = policyBody(sql, "ministry_activities_select");
    expect(body).toContain("'super_admin'");
    expect(body).toContain("'pastor'");
    expect(body).toContain("'secretary'");
    expect(body).toMatch(/'ministry_leader'[\s\S]*?current_ministry_id\(\)/);
    expect(body).not.toContain("'comms_media'");
    expect(body).not.toContain("'finance'");
  });

  // Originally Super Admin or the owning ministry_leader; 0021 withdraws
  // the Ministry Leader's write access here too (Super Admin only now —
  // see groups_ministry_leader_readonly_rls.test.js). policyBody() takes
  // the LAST `create policy ministry_activities_write` in the concatenated
  // SQL, i.e. 0021's drop+recreate, not 0016's original.
  it("write is super_admin only per 0021 — ministry_leader/pastor/secretary/comms_media/finance all excluded", () => {
    const body = policyBody(sql, "ministry_activities_write");
    expect(body).toContain("'super_admin'");
    expect(body).not.toContain("'ministry_leader'");
    expect(body).not.toContain("'pastor'");
    expect(body).not.toContain("'secretary'");
    expect(body).not.toContain("'comms_media'");
    expect(body).not.toContain("'finance'");
  });
});
