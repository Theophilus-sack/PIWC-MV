import { describe, it, expect } from "vitest";
import { smsSegmentInfo, normalizeGhanaPhone, validateSendRequest, MAX_RECIPIENTS_PER_SEND } from "./sms.js";

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
