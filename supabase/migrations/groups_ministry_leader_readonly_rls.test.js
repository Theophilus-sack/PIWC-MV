import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Static checks for 0021_ministry_leader_readonly_groups.sql — see
// phase2_rls.test.js's header comment for what this style of test can and
// can't prove. What matters here: Ministry/Department Leader write access
// to ministry_members and ministry_activities has been fully withdrawn
// (was "own ministry" scoped before 0021), while their read access to
// their own ministry's roster/activities/members is untouched, and a
// leader with no ministry_id assigned still can't fall back to seeing
// everyone else's.

const migrationsDir = dirname(fileURLToPath(import.meta.url));

function allMigrationSql() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
    .join("\n\n");
}

// "Last" matters — 0021 intentionally re-defines these after dropping
// 0002's/0016's originals, same pattern 0002 used on Phase 1's
// ministries_write.
function policyBody(sql, policyName) {
  const pattern = new RegExp(
    `create policy ${policyName}[\\s\\S]*?(?=create policy |create (?:table|view|function|trigger)|$)`,
    "g"
  );
  const matches = sql.match(pattern);
  if (!matches?.length) throw new Error(`policy ${policyName} not found`);
  return matches[matches.length - 1];
}

describe("0021 ministry leader read-only RLS (static)", () => {
  let sql;
  beforeAll(() => { sql = allMigrationSql(); });

  it("corrects the policies via drop + recreate, not by editing 0002/0016 in place", () => {
    expect(sql).toMatch(/drop policy if exists ministry_members_write on ministry_members/);
    expect(sql).toMatch(/drop policy if exists ministry_activities_write on ministry_activities/);
  });

  for (const table of ["ministry_members", "ministry_activities"]) {
    it(`${table}_write: super_admin only — ministry_leader/pastor/secretary/comms_media/finance all excluded`, () => {
      const body = policyBody(sql, `${table}_write`);
      expect(body).toMatch(/using\s*\(\s*current_app_role\(\)\s*=\s*'super_admin'\s*\)/);
      expect(body).not.toContain("'ministry_leader'");
      expect(body).not.toContain("'pastor'");
      expect(body).not.toContain("'secretary'");
      expect(body).not.toContain("'comms_media'");
      expect(body).not.toContain("'finance'");
    });

    it(`${table}_select: still scopes a Ministry Leader to their own ministry_id (read access unchanged)`, () => {
      const body = policyBody(sql, `${table}_select`);
      expect(body).toMatch(/'ministry_leader'[\s\S]*?current_ministry_id\(\)/);
    });

    it(`${table}_select: no fallback that would expose all rows when ministry_id is unassigned`, () => {
      const body = policyBody(sql, `${table}_select`);
      expect(body).not.toMatch(/current_ministry_id\(\)\s+is\s+null/i);
    });
  }

  it("members_select still scopes a Ministry Leader to members in their own ministry (via ministry_members) — unchanged by 0021", () => {
    const body = policyBody(sql, "members_select");
    expect(body).toMatch(/'ministry_leader'[\s\S]*?ministry_members/);
    expect(body).toMatch(/current_ministry_id\(\)/);
  });

  it("ministries_write is still Super Admin only — Add/Edit/Delete ministry stays out of Ministry Leader's reach", () => {
    const body = policyBody(sql, "ministries_write");
    expect(body).toMatch(/current_app_role\(\)\s*=\s*'super_admin'/);
    expect(body).not.toContain("'ministry_leader'");
  });
});
