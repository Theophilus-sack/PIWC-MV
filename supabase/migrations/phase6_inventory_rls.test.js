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

describe("Phase 6 Inventory RLS policies (static)", () => {
  let sql;
  beforeAll(() => { sql = allMigrationSql(); });

  it("inventory has row level security enabled", () => {
    expect(sql).toMatch(/alter table inventory enable row level security/);
  });

  it("select allows super_admin/secretary/pastor, nothing else", () => {
    const body = policyBody(sql, "inventory_select");
    expect(body).toContain("'super_admin'");
    expect(body).toContain("'secretary'");
    expect(body).toContain("'pastor'");
    expect(body).not.toContain("'ministry_leader'");
    expect(body).not.toContain("'comms_media'");
    expect(body).not.toContain("'finance'");
  });

  it("write restricted to super_admin/secretary — NOT pastor (view-only per spec)", () => {
    const body = policyBody(sql, "inventory_write");
    expect(body).toContain("'super_admin'");
    expect(body).toContain("'secretary'");
    expect(body).not.toContain("'pastor'");
    expect(body).not.toContain("'ministry_leader'");
    expect(body).not.toContain("'comms_media'");
    expect(body).not.toContain("'finance'");
  });
});
