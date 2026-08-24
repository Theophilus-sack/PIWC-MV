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
  return readFileSync(join(migrationsDir, "0022_presbyter_portfolio.sql"), "utf8");
}

describe("0022_presbyter_portfolio.sql (static)", () => {
  let sql, own;
  beforeAll(() => {
    sql = allMigrationSql();
    own = ownSql();
  });

  it("adds portfolio via ADD COLUMN, not a rename/drop of an existing column", () => {
    expect(own).toMatch(/alter table presbyters add column portfolio text/);
    expect(sql).not.toMatch(/alter table presbyters\s+rename column/i);
    expect(sql).not.toMatch(/alter table presbyters\s+drop column/i);
  });

  it("constrains portfolio to exactly Elder/Deacon/Deaconess — nothing else", () => {
    const match = own.match(/check\s*\(\s*portfolio in \(([^)]*)\)\s*\)/);
    expect(match).toBeTruthy();
    const values = match[1].split(",").map((s) => s.trim().replace(/'/g, ""));
    expect(values.sort()).toEqual(["Deacon", "Deaconess", "Elder"]);
  });

  it("touches no RLS policy — presbyters_select/presbyters_write (0002) are table-level, so they already cover this column", () => {
    expect(own).not.toMatch(/create policy presbyters_/);
    expect(own).not.toMatch(/alter policy/i);
    // The existing role matrix (super_admin/pastor/secretary write, everyone
    // authenticated read — i.e. Ministry Leader/Comms get view) is asserted
    // in phase2_rls.test.js and stays valid since this migration never
    // redefines those policies.
    expect(sql.match(/create policy presbyters_write/g)?.length).toBe(1);
    expect(sql.match(/create policy presbyters_select/g)?.length).toBe(1);
  });
});
