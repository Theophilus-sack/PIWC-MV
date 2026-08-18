import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Same static-check approach as phase2/phase3 — proves the SQL says what
// the spec's Messages matrix row says (Super Admin/Comms Media: Full,
// Ministry Leader: Own, Secretary: Send [general only], Pastor: View,
// Finance: nothing), not that Postgres actually enforces it live.

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

describe("Phase 4 Messaging RLS policies (static)", () => {
  let sql;
  beforeAll(() => { sql = allMigrationSql(); });

  it("every messaging table has row level security enabled", () => {
    for (const table of ["sms_templates", "sms_batches", "sms_messages"]) {
      expect(sql).toMatch(new RegExp(`alter table ${table} enable row level security`));
    }
  });

  it("sms_batches has a recipient_count > 0 check (zero-recipient batches rejected at the DB, not just the UI)", () => {
    expect(sql).toMatch(/check\s*\(\s*recipient_count\s*>\s*0\s*\)/);
  });

  describe("sms_templates", () => {
    it("select allows every Messages-access role", () => {
      const body = policyBody(sql, "sms_templates_select");
      for (const role of ["super_admin", "pastor", "ministry_leader", "comms_media", "secretary"]) {
        expect(body).toContain(`'${role}'`);
      }
      expect(body).not.toContain("'finance'");
    });

    it("write restricted to super_admin/comms_media — NOT pastor (view-only per spec)", () => {
      const body = policyBody(sql, "sms_templates_write");
      expect(body).toContain("'super_admin'");
      expect(body).toContain("'comms_media'");
      expect(body).not.toContain("'pastor'");
      expect(body).not.toContain("'secretary'");
      expect(body).not.toContain("'ministry_leader'");
      expect(body).not.toContain("'finance'");
    });
  });

  describe("sms_batches / sms_messages", () => {
    for (const table of ["sms_batches", "sms_messages"]) {
      it(`${table}: select — super_admin/pastor/comms_media unrestricted, ministry_leader scoped to own ministry, secretary scoped to general only`, () => {
        const body = policyBody(sql, `${table}_select`);
        expect(body).toContain("'super_admin'");
        expect(body).toContain("'pastor'");
        expect(body).toContain("'comms_media'");
        expect(body).toMatch(/'ministry_leader'[\s\S]*?current_ministry_id\(\)/);
        expect(body).toMatch(/'secretary'[\s\S]*?ministry_id is null/);
        expect(body).not.toContain("'finance'");
      });

      it(`${table}: insert — pastor excluded (view-only), finance excluded entirely`, () => {
        const body = policyBody(sql, `${table}_insert`);
        expect(body).toContain("'super_admin'");
        expect(body).toContain("'comms_media'");
        expect(body).toMatch(/'ministry_leader'[\s\S]*?current_ministry_id\(\)/);
        expect(body).toMatch(/'secretary'[\s\S]*?ministry_id is null/);
        expect(body).not.toContain("'pastor'");
        expect(body).not.toContain("'finance'");
      });
    }
  });
});
