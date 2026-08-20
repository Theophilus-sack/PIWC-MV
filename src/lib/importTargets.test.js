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
    const result = validateRow({ name: "A", ministry: "women's ministry" }, { ministries: [{ id: "m1", name: "Women's Ministry" }] });
    expect(result.ok).toBe(true);
    expect(result.row.ministryId).toBe("m1");
    expect(result.warnings).toEqual([]);
  });

  it("warns (but still imports) on an unrecognized ministry name", () => {
    const result = validateRow({ name: "A", ministry: "Nonexistent Ministry" }, { ministries: [] });
    expect(result.ok).toBe(true);
    expect(result.row.ministryId).toBeNull();
    expect(result.warnings.length).toBe(1);
  });
});
