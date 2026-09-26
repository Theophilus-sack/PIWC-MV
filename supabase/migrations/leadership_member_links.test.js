import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Static checks for 0025_leadership_member_links.sql — see
// phase2_rls.test.js's header comment for what this style of test can and
// can't prove without a live Postgres instance. What matters here: the
// member_id foreign key actually exists (so a fabricated/nonexistent id
// can't be saved even if the UI's MemberPicker were somehow bypassed), the
// legacy name/contact/leader_name columns were never dropped (old records
// must keep displaying), member_id was never forced NOT NULL (that would
// break every pre-existing row), and the duplicate-assignment constraints
// exist without weakening presbyters/ministry_leadership's write RLS.

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

describe("0025 leadership member links (static)", () => {
  let sql;
  let ownSql;
  beforeAll(() => {
    sql = allMigrationSql();
    // Scoped to 0025's own file for assertions that would otherwise false-
    // positive against unrelated tables in the wider schema — e.g.
    // ministry_members.member_id and attendance_records.member_id are
    // legitimately "not null" (they're plain join/fact tables, not
    // migrated-from-free-text Leadership columns), so a blanket search
    // across every migration for "member_id ... not null" would flag
    // those instead of proving anything about presbyters/ministry_leadership.
    ownSql = readFileSync(join(migrationsDir, "0025_leadership_member_links.sql"), "utf8");
  });

  it("presbyters.member_id references members(id) with ON DELETE RESTRICT", () => {
    expect(sql).toMatch(
      /alter table presbyters add column member_id uuid references members\(id\) on delete restrict/
    );
  });

  it("ministry_leadership.member_id references members(id) with ON DELETE RESTRICT", () => {
    expect(sql).toMatch(
      /alter table ministry_leadership add column member_id uuid references members\(id\) on delete restrict/
    );
  });

  it("presbyters.portfolio is constrained to Elder/Deacon/Deaconess", () => {
    expect(sql).toMatch(/portfolio text check \(portfolio in \('Elder', 'Deacon', 'Deaconess'\)\)/);
  });

  it("0025 never forces its new member_id columns to NOT NULL — that would break every pre-existing row", () => {
    expect(ownSql).not.toMatch(/alter column member_id set not null/i);
    expect(ownSql).not.toMatch(/member_id uuid not null/i);
  });

  it("never drops the legacy name/contact/leader_name columns old unmatched records still rely on", () => {
    for (const table of ["presbyters", "ministry_leadership"]) {
      expect(sql).not.toMatch(new RegExp(`alter table ${table}\\s+drop column`, "i"));
    }
  });

  it("backfill only links a legacy row when exactly one member matches its name (no guessing at ambiguous duplicates)", () => {
    expect(sql).toMatch(/match_count = 1/);
    expect(sql).toMatch(/lower\(trim\(m\.name\)\) = lower\(trim\(p\.name\)\)/);
    expect(sql).toMatch(/lower\(trim\(m\.name\)\) = lower\(trim\(l\.leader_name\)\)/);
  });

  it("the same member cannot be added as a Presbyter twice", () => {
    expect(sql).toMatch(/alter table presbyters add constraint presbyters_member_id_key unique \(member_id\)/);
  });

  it("the same member cannot hold the same portfolio in the same ministry/department twice", () => {
    expect(sql).toMatch(
      /alter table ministry_leadership add constraint ministry_leadership_ministry_member_portfolio_key\s*\n\s*unique \(ministry_id, member_id, portfolio\)/
    );
  });

  it("Leadership write RLS is unchanged by 0025 — still Super Admin/Pastor/Secretary, not Ministry Leader/Comms/Finance", () => {
    for (const table of ["presbyters", "ministry_leadership"]) {
      const body = policyBody(sql, `${table}_write`);
      expect(body).toContain("'super_admin'");
      expect(body).toContain("'pastor'");
      expect(body).toContain("'secretary'");
      expect(body).not.toContain("'ministry_leader'");
      expect(body).not.toContain("'comms_media'");
      expect(body).not.toContain("'finance'");
    }
  });
});
