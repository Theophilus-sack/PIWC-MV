import { describe, it, expect } from "vitest";
import { IMPORT_TARGETS } from "./importTargets.js";

describe("manualContacts.validateRow", () => {
  const { validateRow } = IMPORT_TARGETS.manualContacts;

  it("accepts a fully valid row", () => {
    const result = validateRow({ full_name: "Kwame Mensah", phone: "0241234567", email: "k@example.com" });
    expect(result.ok).toBe(true);
    expect(result.row.fullName).toBe("Kwame Mensah");
    expect(result.row.phone).toBe("233241234567");
    expect(result.duplicateValue).toBe("233241234567");
  });

  it("rejects a missing full name", () => {
    const result = validateRow({ full_name: "", phone: "0241234567" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Missing full name");
  });

  it("rejects a missing phone", () => {
    const result = validateRow({ full_name: "Kwame", phone: "" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Missing phone number");
  });

  it("rejects an invalid phone", () => {
    const result = validateRow({ full_name: "Kwame", phone: "024ABC123" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid phone number");
  });

  it("rejects an invalid email but keeps a valid phone/name", () => {
    const result = validateRow({ full_name: "Kwame", phone: "0241234567", email: "abc@" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid email address");
  });

  it("allows a blank email", () => {
    const result = validateRow({ full_name: "Kwame", phone: "0241234567", email: "" });
    expect(result.ok).toBe(true);
  });
});

describe("members.validateRow", () => {
  const { validateRow } = IMPORT_TARGETS.members;

  it("accepts a minimal valid row (only name required)", () => {
    const result = validateRow({ name: "Ama Boateng" });
    expect(result.ok).toBe(true);
    expect(result.row.status).toBe("stay");
  });

  it("rejects a missing name", () => {
    const result = validateRow({ name: "" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Missing name");
  });

  it("normalizes gender case-insensitively", () => {
    expect(validateRow({ name: "A", gender: "FEMALE" }).row.gender).toBe("Female");
    expect(validateRow({ name: "A", gender: "male" }).row.gender).toBe("Male");
  });

  it("rejects an invalid gender", () => {
    const result = validateRow({ name: "A", gender: "Other" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid gender (expected Male/Female)");
  });

  it("rejects an invalid phone when contact is provided", () => {
    const result = validateRow({ name: "A", contact: "not-a-phone" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid phone number");
  });

  it("allows a blank contact", () => {
    const result = validateRow({ name: "A", contact: "" });
    expect(result.ok).toBe(true);
    expect(result.row.contact).toBeNull();
  });

  it("rejects an invalid status", () => {
    const result = validateRow({ name: "A", status: "member" });
    expect(result.ok).toBe(false);
  });

  it("maps a recognized ministry name to its id", () => {
    const result = validateRow({ name: "A", ministry: "women's ministry" }, { ministries: [{ id: "m1", name: "Women's Ministry", assembly: "English" }] });
    expect(result.ok).toBe(true);
    expect(result.row.ministryIds).toEqual(["m1"]);
    expect(result.warnings).toEqual([]);
  });

  it("warns (but still imports) on an unrecognized ministry name", () => {
    const result = validateRow({ name: "A", ministry: "Nonexistent Ministry" }, { ministries: [] });
    expect(result.ok).toBe(true);
    expect(result.row.ministryIds).toEqual([]);
    expect(result.warnings.length).toBe(1);
  });

  it("a ministry name only matches non-'Both' (Department) entries", () => {
    const result = validateRow(
      { name: "A", ministry: "Media Team" },
      { ministries: [{ id: "d1", name: "Media Team", assembly: "Both" }] }
    );
    expect(result.ok).toBe(true);
    expect(result.row.ministryIds).toEqual([]); // Both-assembly entries are Departments, not Ministries
    expect(result.warnings.length).toBe(1);
  });

  it("maps a recognized department name (assembly='Both') to its id", () => {
    const result = validateRow(
      { name: "A", department: "media team" },
      { ministries: [{ id: "d1", name: "Media Team", assembly: "Both" }] }
    );
    expect(result.ok).toBe(true);
    expect(result.row.ministryIds).toEqual(["d1"]);
    expect(result.warnings).toEqual([]);
  });

  it("warns (but still imports) on an unrecognized department name", () => {
    const result = validateRow({ name: "A", department: "Nonexistent Department" }, { ministries: [] });
    expect(result.ok).toBe(true);
    expect(result.row.ministryIds).toEqual([]);
    expect(result.warnings.length).toBe(1);
  });

  it("combines both a matched ministry and a matched department into one ministryIds array", () => {
    const result = validateRow(
      { name: "A", ministry: "Women's Ministry", department: "Media Team" },
      { ministries: [
        { id: "m1", name: "Women's Ministry", assembly: "English" },
        { id: "d1", name: "Media Team", assembly: "Both" },
      ] }
    );
    expect(result.ok).toBe(true);
    expect(result.row.ministryIds).toEqual(["m1", "d1"]);
  });

  it("normalizes marital_status case-insensitively against the 6 allowed values", () => {
    expect(validateRow({ name: "A", marital_status: "MARRIED" }).row.marital_status).toBe("Married");
    expect(validateRow({ name: "A", marital_status: "single" }).row.marital_status).toBe("Single");
  });

  it("allows a blank marital_status", () => {
    const result = validateRow({ name: "A", marital_status: "" });
    expect(result.ok).toBe(true);
    expect(result.row.marital_status).toBeNull();
  });

  it("rejects an invalid marital_status", () => {
    const result = validateRow({ name: "A", marital_status: "It's Complicated" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/Invalid marital status/);
  });

  it("validates whatsapp_number the same way as contact, and it's optional", () => {
    expect(validateRow({ name: "A", whatsapp_number: "" }).row.whatsapp_number).toBeNull();
    expect(validateRow({ name: "A", whatsapp_number: "0241234567" }).row.whatsapp_number).toBe("233241234567");
    const result = validateRow({ name: "A", whatsapp_number: "not-a-phone" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid WhatsApp number");
  });

  it("nationality is free text; blank becomes undefined so the DB default ('Ghana') applies, not an explicit null", () => {
    expect(validateRow({ name: "A", nationality: "Nigeria" }).row.nationality).toBe("Nigeria");
    expect(validateRow({ name: "A", nationality: "" }).row.nationality).toBeUndefined();
  });

  it("free-text education/work fields trim and null-out when blank", () => {
    const result = validateRow({
      name: "A", educational_professional_background: " Accountant ",
      educational_institution: "", workplace_name: "  ",
    });
    expect(result.row.educational_professional_background).toBe("Accountant");
    expect(result.row.educational_institution).toBeNull();
    expect(result.row.workplace_name).toBeNull();
  });

  it("validates email and allows it to be blank", () => {
    expect(validateRow({ name: "A", email: "" }).row.email).toBeNull();
    expect(validateRow({ name: "A", email: "ama@example.com" }).row.email).toBe("ama@example.com");
    const result = validateRow({ name: "A", email: "not-an-email" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid email address");
  });

  it("skills_talents is free text, trimmed, null when blank", () => {
    expect(validateRow({ name: "A", skills_talents: " Graphic design, singing " }).row.skills_talents).toBe("Graphic design, singing");
    expect(validateRow({ name: "A", skills_talents: "" }).row.skills_talents).toBeNull();
  });

  describe("member_id (one-time historical backfill)", () => {
    it("is undefined when blank, so the DB trigger generates a fresh one", () => {
      const result = validateRow({ name: "A" });
      expect(result.ok).toBe(true);
      expect(result.row.member_id).toBeUndefined();
    });

    it("accepts and passes through a correctly formatted pre-assigned id as-is", () => {
      const result = validateRow({ name: "A", member_id: "PIWC-2024-0389" });
      expect(result.ok).toBe(true);
      expect(result.row.member_id).toBe("PIWC-2024-0389");
    });

    it("accepts an id whose sequence has grown past 4 digits", () => {
      const result = validateRow({ name: "A", member_id: "PIWC-2026-12345" });
      expect(result.ok).toBe(true);
      expect(result.row.member_id).toBe("PIWC-2026-12345");
    });

    it("rejects a malformed member_id", () => {
      for (const bad of ["389", "PIWC-26-0389", "PIWC-2024-389", "piwc-2024-0389 "]) {
        const result = validateRow({ name: "A", member_id: bad });
        expect(result.ok).toBe(false);
        expect(result.errors[0]).toMatch(/Invalid Member ID format/);
      }
    });
  });
});
