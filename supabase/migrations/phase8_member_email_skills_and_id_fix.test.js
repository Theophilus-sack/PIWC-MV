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

function ownSql() {
  return readFileSync(join(migrationsDir, "0021_member_email_skills_and_id_year_fix.sql"), "utf8");
}

describe("0021_member_email_skills_and_id_year_fix.sql (static)", () => {
  let sql, own;
  beforeAll(() => {
    sql = allMigrationSql();
    own = ownSql();
  });

  it("adds email and skills_talents via ADD COLUMN", () => {
    expect(own).toMatch(/alter table members add column email text/);
    expect(own).toMatch(/alter table members add column skills_talents text/);
  });

  it("never renames or drops an existing members column, anywhere in migration history", () => {
    expect(sql).not.toMatch(/alter table members\s+rename column/i);
    expect(sql).not.toMatch(/alter table members\s+drop column/i);
  });

  it("touches no RLS policy", () => {
    expect(own).not.toMatch(/create policy members_/);
    expect(own).not.toMatch(/alter policy/i);
  });

  it("re-points set_member_id() at created_at instead of date_joined for the id's year", () => {
    expect(own).toMatch(/create or replace function set_member_id\(\)/);
    expect(own).toMatch(/extract\(year from new\.created_at\)/);
    expect(own).not.toMatch(/extract\(year from coalesce\(new\.date_joined/);
  });

  it("still generates only when member_id is null — a caller-supplied id (bulk historical import) is left alone", () => {
    expect(own).toMatch(/if new\.member_id is null then/);
  });

  it("doesn't touch the sequence, the update-protect trigger, or the unique constraint — all already correct from 0020", () => {
    expect(own).not.toMatch(/create sequence/);
    expect(own).not.toMatch(/on_member_update_protect_id/);
    expect(own).not.toMatch(/add column member_id/);
  });
});
