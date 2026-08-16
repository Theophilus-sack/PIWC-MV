import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Static checks on the RLS policy SQL itself — a real end-to-end proof
// that e.g. "a Ministry Leader viewing another ministry's data is blocked"
// needs a live Postgres instance running the actual policies (Vitest can't
// do that). What this file DOES catch: a policy naming the wrong roles, a
// missing delete restriction, or Phase 1's ministries_write regression
// (Pastor had write access when the spec only grants Pastor "view" on
// Groups/Ministries) — transcription errors between the spec's matrix and
// what's actually in the SQL, without needing a database.
//
// The manual smoke test (logging in as a second-role account and hitting
// a blocked action for real) is still the thing that proves RLS actually
// runs — see the Phase 2 summary for that checklist.

const migrationsDir = dirname(fileURLToPath(import.meta.url));

function allMigrationSql() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
    .join("\n\n");
}

// Extracts the body of the LAST `create policy <name> ...` statement up to
// the next `create policy`/`create table`/`create view`/EOF. "Last" matters
// because 0002 intentionally re-defines ministries_write after dropping
// Phase 1's version.
function policyBody(sql, policyName) {
  const pattern = new RegExp(
    `create policy ${policyName}[\\s\\S]*?(?=create policy |create (?:table|view|function|trigger)|$)`,
    "g"
  );
  const matches = sql.match(pattern);
  if (!matches?.length) throw new Error(`policy ${policyName} not found`);
  return matches[matches.length - 1];
}

describe("Phase 2 RLS policies (static)", () => {
  let sql;
  beforeAll(() => { sql = allMigrationSql(); });

  it("ministries_write is tightened to Super Admin only (Phase 1 gave Pastor write access; spec says Pastor = view only)", () => {
    const body = policyBody(sql, "ministries_write");
    expect(body).toContain("'super_admin'");
    expect(body).not.toContain("'pastor'");
  });

  describe("members", () => {
    it("select allows super_admin/pastor/secretary fully, ministry_leader only via ministry_members", () => {
      const body = policyBody(sql, "members_select");
      expect(body).toMatch(/'super_admin'/);
      expect(body).toMatch(/'pastor'/);
      expect(body).toMatch(/'secretary'/);
      expect(body).toMatch(/ministry_leader/);
      expect(body).toMatch(/ministry_members/); // scoped via the join table, not a direct column
    });

    it("insert/update: Super Admin + Secretary only (spec: 'Secretary | Full (add/edit)')", () => {
      for (const policy of ["members_insert", "members_update"]) {
        const body = policyBody(sql, policy);
        expect(body).toContain("'super_admin'");
        expect(body).toContain("'secretary'");
        expect(body).not.toContain("'pastor'");
        expect(body).not.toContain("'finance'");
        expect(body).not.toContain("'ministry_leader'");
        expect(body).not.toContain("'comms_media'");
      }
    });

    it("delete: Super Admin only — Secretary's 'Full' access explicitly excludes delete per spec wording", () => {
      const body = policyBody(sql, "members_delete");
      expect(body).toContain("'super_admin'");
      expect(body).not.toContain("'secretary'");
    });

    it("member deletion is audited (spec calls this out specifically)", () => {
      expect(sql).toMatch(/create trigger on_member_delete/);
      expect(sql).toMatch(/log_audit_event\(\s*'member_delete'/);
    });
  });

  describe("leadership directory (presbyters + ministry_leadership)", () => {
    for (const table of ["presbyters", "ministry_leadership"]) {
      it(`${table}: write restricted to super_admin/pastor/secretary, not ministry_leader/comms/finance`, () => {
        const body = policyBody(sql, `${table}_write`);
        expect(body).toContain("'super_admin'");
        expect(body).toContain("'pastor'");
        expect(body).toContain("'secretary'");
        expect(body).not.toContain("'ministry_leader'");
        expect(body).not.toContain("'comms_media'");
        expect(body).not.toContain("'finance'");
      });
    }
  });

  describe("ministry_members (Groups/Ministries roster)", () => {
    it("write is Super Admin or the owning Ministry Leader only — not Secretary (view-only per spec)", () => {
      const body = policyBody(sql, "ministry_members_write");
      expect(body).toContain("'super_admin'");
      expect(body).toContain("current_ministry_id()");
      expect(body).not.toContain("'secretary'");
      expect(body).not.toContain("'pastor'");
    });
  });

  describe("attendance (service_dates + attendance_records)", () => {
    it("service_dates/attendance_records delete: Super Admin only", () => {
      for (const table of ["service_dates", "attendance_records"]) {
        const body = policyBody(sql, `${table}_delete`);
        expect(body.trim()).toMatch(/using\s*\(\s*current_app_role\(\)\s*=\s*'super_admin'\s*\)/);
      }
    });

    it("insert scoping: Secretary only when ministry_id is null (general/Sunday), Ministry Leader only their own", () => {
      for (const table of ["service_dates", "attendance_records"]) {
        const body = policyBody(sql, `${table}_insert`);
        expect(body).toMatch(/'secretary'[\s\S]*?ministry_id is null/);
        expect(body).toMatch(/'ministry_leader'[\s\S]*?current_ministry_id\(\)/);
        expect(body).not.toContain("'comms_media'");
        expect(body).not.toContain("'finance'");
      }
    });
  });

  it("every new table has row level security enabled", () => {
    for (const table of ["members", "presbyters", "ministry_leadership", "ministry_members", "service_dates", "attendance_records"]) {
      expect(sql).toMatch(new RegExp(`alter table ${table} enable row level security`));
    }
  });
});
