import { describe, it, expect } from "vitest";
import {
  smsSegmentInfo, normalizeGhanaPhone, validateSendRequest, MAX_RECIPIENTS_PER_SEND,
  splitName, applyTemplateVariables, dedupeRecipientsByPhone,
} from "./sms.js";

describe("smsSegmentInfo", () => {
  it("empty body is zero segments", () => {
    expect(smsSegmentInfo("")).toEqual({ length: 0, segments: 0, perSegment: 160 });
    expect(smsSegmentInfo(undefined)).toEqual({ length: 0, segments: 0, perSegment: 160 });
  });
  it("fits in one segment at 160 chars", () => {
    const body = "a".repeat(160);
    expect(smsSegmentInfo(body)).toEqual({ length: 160, segments: 1, perSegment: 160 });
  });
  it("161 chars spills into a second (153-char) segment", () => {
    const body = "a".repeat(161);
    expect(smsSegmentInfo(body)).toEqual({ length: 161, segments: 2, perSegment: 153 });
  });
  it("306 chars (2x153) is exactly two segments", () => {
    const body = "a".repeat(306);
    expect(smsSegmentInfo(body).segments).toBe(2);
  });
  it("307 chars spills into a third segment", () => {
    const body = "a".repeat(307);
    expect(smsSegmentInfo(body).segments).toBe(3);
  });
});

describe("normalizeGhanaPhone", () => {
  it("normalizes a local 0-prefixed number to 233 shape", () => {
    expect(normalizeGhanaPhone("0244555123")).toBe("233244555123");
  });
  it("strips spaces and dashes before normalizing", () => {
    expect(normalizeGhanaPhone("024 455 5123")).toBe("233244555123");
    expect(normalizeGhanaPhone("024-455-5123")).toBe("233244555123");
  });
  it("accepts an already-233-prefixed number", () => {
    expect(normalizeGhanaPhone("233244555123")).toBe("233244555123");
  });
  it("strips a leading + and international 00 prefix", () => {
    expect(normalizeGhanaPhone("+233244555123")).toBe("233244555123");
    expect(normalizeGhanaPhone("00233244555123")).toBe("233244555123");
  });
  it("accepts a bare 9-digit subscriber number", () => {
    expect(normalizeGhanaPhone("244555123")).toBe("233244555123");
  });
  it("returns null for empty/missing input", () => {
    expect(normalizeGhanaPhone("")).toBeNull();
    expect(normalizeGhanaPhone(null)).toBeNull();
    expect(normalizeGhanaPhone(undefined)).toBeNull();
  });
  it("returns null for something that isn't a recognizable Ghanaian number", () => {
    expect(normalizeGhanaPhone("123")).toBeNull();
    expect(normalizeGhanaPhone("not a phone number")).toBeNull();
  });
});

describe("validateSendRequest", () => {
  const base = { body: "Service reminder", recipients: [{ phone: "0244555123" }] };

  it("accepts a well-formed request", () => {
    expect(validateSendRequest(base)).toEqual({ ok: true });
  });

  it("rejects an empty body", () => {
    expect(validateSendRequest({ ...base, body: "" }).ok).toBe(false);
    expect(validateSendRequest({ ...base, body: "   " }).ok).toBe(false);
  });

  it("rejects zero recipients", () => {
    const result = validateSendRequest({ ...base, recipients: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/recipient/i);
  });

  it("rejects more than MAX_RECIPIENTS_PER_SEND recipients", () => {
    const recipients = Array.from({ length: MAX_RECIPIENTS_PER_SEND + 1 }, (_, i) => ({ phone: String(i) }));
    const result = validateSendRequest({ ...base, recipients });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });

  it("accepts exactly MAX_RECIPIENTS_PER_SEND recipients", () => {
    const recipients = Array.from({ length: MAX_RECIPIENTS_PER_SEND }, (_, i) => ({ phone: String(i) }));
    expect(validateSendRequest({ ...base, recipients }).ok).toBe(true);
  });

  it("rejects a scheduled time in the past", () => {
    const result = validateSendRequest({ ...base, scheduledAt: new Date(Date.now() - 60_000).toISOString() });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/future/i);
  });

  it("accepts a scheduled time in the future", () => {
    const result = validateSendRequest({ ...base, scheduledAt: new Date(Date.now() + 60_000).toISOString() });
    expect(result.ok).toBe(true);
  });

  it("rejects an invalid scheduled time", () => {
    const result = validateSendRequest({ ...base, scheduledAt: "not-a-date" });
    expect(result.ok).toBe(false);
  });
});

describe("splitName", () => {
  it("splits a two-word name into first/last", () => {
    expect(splitName("Isaac Mensah")).toEqual({ firstName: "Isaac", lastName: "Mensah" });
  });
  it("joins remaining words into lastName for a three-word name", () => {
    expect(splitName("Kofi Ama Boateng")).toEqual({ firstName: "Kofi", lastName: "Ama Boateng" });
  });
  it("a single-word name has an empty lastName", () => {
    expect(splitName("Isaac")).toEqual({ firstName: "Isaac", lastName: "" });
  });
  it("collapses extra internal whitespace", () => {
    expect(splitName("Isaac   Mensah")).toEqual({ firstName: "Isaac", lastName: "Mensah" });
  });
  it("empty/missing name returns empty strings, not undefined", () => {
    expect(splitName("")).toEqual({ firstName: "", lastName: "" });
    expect(splitName(null)).toEqual({ firstName: "", lastName: "" });
    expect(splitName(undefined)).toEqual({ firstName: "", lastName: "" });
  });
});

describe("applyTemplateVariables", () => {
  it("resolves every supported variable", () => {
    const result = applyTemplateVariables(
      "Dear {{first_name}} {{last_name}} ({{full_name}}), reach us on {{phone}}. — {{ministry}}",
      { firstName: "Isaac", lastName: "Mensah", fullName: "Isaac Mensah", phone: "233244555123", ministry: "Youth" }
    );
    expect(result).toBe("Dear Isaac Mensah (Isaac Mensah), reach us on 233244555123. — Youth");
  });

  it("replaces a variable used more than once in the same message", () => {
    const result = applyTemplateVariables("{{first_name}}, hi {{first_name}}!", { firstName: "Ama" });
    expect(result).toBe("Ama, hi Ama!");
  });

  it("missing recipient fields resolve to an empty string, not the literal token", () => {
    const result = applyTemplateVariables("Dear {{first_name}}, from {{ministry}}", { firstName: "Ama" });
    expect(result).toBe("Dear Ama, from ");
    expect(result).not.toContain("{{");
  });

  it("a body with no variables passes through unchanged", () => {
    expect(applyTemplateVariables("Plain message, no tokens.", { firstName: "Ama" })).toBe("Plain message, no tokens.");
  });

  it("handles a completely missing recipient object", () => {
    expect(applyTemplateVariables("Hi {{first_name}}", undefined)).toBe("Hi ");
  });
});

describe("dedupeRecipientsByPhone", () => {
  it("keeps recipients with distinct phone numbers", () => {
    const recipients = [{ phone: "0244555123" }, { phone: "0207778899" }];
    const result = dedupeRecipientsByPhone(recipients);
    expect(result.recipients).toHaveLength(2);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it("drops a later duplicate, keeping the first occurrence", () => {
    const recipients = [{ name: "Member A", phone: "0244555123" }, { name: "Manual B", phone: "0244555123" }];
    const result = dedupeRecipientsByPhone(recipients);
    expect(result.recipients).toEqual([{ name: "Member A", phone: "0244555123" }]);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it("recognizes duplicates across different phone formats for the same number", () => {
    const recipients = [{ phone: "0244555123" }, { phone: "+233244555123" }, { phone: "233244555123" }];
    const result = dedupeRecipientsByPhone(recipients);
    expect(result.recipients).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(2);
  });

  it("empty input returns empty output", () => {
    expect(dedupeRecipientsByPhone([])).toEqual({ recipients: [], duplicatesRemoved: 0 });
  });
});
