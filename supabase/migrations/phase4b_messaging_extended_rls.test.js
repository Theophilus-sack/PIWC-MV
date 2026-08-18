import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Same static-check approach as phase2/3/4 — proves the SQL says what it
// should, not that Postgres actually enforces it live.

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

describe("Phase 4b messaging-extension RLS policies (static)", () => {
  let sql;
  beforeAll(() => { sql = allMigrationSql(); });

  it("manual_contacts and message_automations have row level security enabled", () => {
    for (const table of ["manual_contacts", "message_automations"]) {
      expect(sql).toMatch(new RegExp(`alter table ${table} enable row level security`));
    }
  });

  it("manual_contacts.phone has a unique index (exact-duplicate contacts rejected at the DB)", () => {
    expect(sql).toMatch(/create unique index manual_contacts_phone_idx on manual_contacts\(phone\)/);
  });

  for (const table of ["manual_contacts", "message_automations"]) {
    it(`${table}: select allows every Messages-access role`, () => {
      const body = policyBody(sql, `${table}_select`);
      for (const role of ["super_admin", "pastor", "ministry_leader", "comms_media", "secretary"]) {
        expect(body).toContain(`'${role}'`);
      }
      expect(body).not.toContain("'finance'");
    });

    it(`${table}: write restricted to super_admin/comms_media — not pastor, ministry_leader, or secretary`, () => {
      const body = policyBody(sql, `${table}_write`);
      expect(body).toContain("'super_admin'");
      expect(body).toContain("'comms_media'");
      expect(body).not.toContain("'pastor'");
      expect(body).not.toContain("'secretary'");
      expect(body).not.toContain("'ministry_leader'");
      expect(body).not.toContain("'finance'");
    });
  }

  it("message_automations.trigger_type is constrained to the four supported triggers", () => {
    expect(sql).toMatch(/trigger_type in\s*\(\s*'birthday',\s*'welcome',\s*'event_reminder',\s*'follow_up'\s*\)/);
  });

  it("sms_batches_delete was extended to include Secretary for general (ministry_id null) batches — the Scheduled tab's Cancel action needs this, not just super_admin/comms_media/ministry_leader", () => {
    const body = policyBody(sql, "sms_batches_delete");
    expect(body).toContain("'super_admin'");
    expect(body).toContain("'comms_media'");
    expect(body).toMatch(/'ministry_leader'[\s\S]*?current_ministry_id\(\)/);
    expect(body).toMatch(/'secretary'[\s\S]*?ministry_id is null/);
  });

  it("sms_templates gained a constrained category column", () => {
    expect(sql).toMatch(/alter table sms_templates add column category text check/);
  });

  it("sms_messages gained resolved_body for per-recipient personalization", () => {
    expect(sql).toMatch(/alter table sms_messages add column resolved_body text/);
  });

  it("audit triggers exist for manual contacts, automations, sms batches, and templates", () => {
    expect(sql).toMatch(/create trigger on_manual_contact_change/);
    expect(sql).toMatch(/create trigger on_automation_change/);
    expect(sql).toMatch(/create trigger on_sms_batch_change/);
    expect(sql).toMatch(/create trigger on_sms_template_change/);
  });
});
