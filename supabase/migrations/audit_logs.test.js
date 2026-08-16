import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Static check that audit_logs stays append-only at the schema level: no
// migration may grant an update/delete policy (or a blanket "for all"
// policy) on audit_logs to any role, including super_admin. This is what
// actually makes "audit log entries can't be edited or deleted through the
// app" true — the API has no path to do it because Postgres itself refuses.
const migrationsDir = dirname(fileURLToPath(import.meta.url));

function allMigrationSql() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
    .join("\n");
}

describe("audit_logs immutability (schema-level)", () => {
  const sql = allMigrationSql();

  it("has a select policy for pastor/super_admin", () => {
    expect(sql).toMatch(/create policy audit_logs_select on audit_logs for select/);
  });

  it("has no update policy on audit_logs, for any role", () => {
    expect(sql).not.toMatch(/create policy [\w]+ on audit_logs for update/);
  });

  it("has no delete policy on audit_logs, for any role", () => {
    expect(sql).not.toMatch(/create policy [\w]+ on audit_logs for delete/);
  });

  it("has no blanket 'for all' policy on audit_logs that would imply write access", () => {
    expect(sql).not.toMatch(/create policy [\w]+ on audit_logs for all/);
  });

  it("writes only happen via the security-definer log_audit_event helper", () => {
    expect(sql).toMatch(/create function log_audit_event/);
    expect(sql).toMatch(/security definer/);
  });
});
