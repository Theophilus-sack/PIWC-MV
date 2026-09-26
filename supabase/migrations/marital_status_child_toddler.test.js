import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Static checks for 0026_marital_status_child_toddler.sql — see
// phase2_rls.test.js's header comment for what this style of test can and
// can't prove without a live Postgres instance.

const migrationsDir = dirname(fileURLToPath(import.meta.url));

function allMigrationSql() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
    .join("\n\n");
}

describe("0026 marital_status Child/Toddler (static)", () => {
  let sql, own;
  beforeAll(() => {
    sql = allMigrationSql();
    own = readFileSync(join(migrationsDir, "0026_marital_status_child_toddler.sql"), "utf8");
  });

  it("discovers the existing check constraint's real name via pg_constraint instead of assuming one", () => {
    expect(own).toMatch(/select\s+con\.conname/i);
    expect(own).toMatch(/from\s+pg_constraint/i);
    expect(own).toMatch(/execute format\('alter table members drop constraint %I', existing_constraint\)/);
  });

  it("recreates the constraint accepting all 6 original values plus Child and Toddler", () => {
    const match = own.match(/check\s*\(\s*marital_status in \(([^)]*)\)\s*\)/i);
    expect(match).toBeTruthy();
    const values = match[1].split(",").map((s) => s.trim().replace(/'/g, ""));
    expect(values.sort()).toEqual(
      ["Child", "Divorced", "Engaged", "Married", "Separated", "Single", "Toddler", "Widowed"]
    );
  });

  it("the recreated constraint lives on members.marital_status, explicitly named", () => {
    expect(own).toMatch(/alter table members add constraint members_marital_status_check/);
  });

  it("never touches existing member rows or drops any column", () => {
    expect(own).not.toMatch(/delete from members/i);
    expect(own).not.toMatch(/update members\s/i);
    expect(own).not.toMatch(/drop column/i);
  });

  it("only one members_marital_status_check-style constraint statement exists across all migrations", () => {
    expect(sql.match(/add constraint members_marital_status_check/g)?.length).toBe(1);
  });
});
