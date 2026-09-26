import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { formatDateOnly } from "./formatDate.js";

describe("formatDateOnly", () => {
  it("formats a date-only string as en-GB short (DD Mon YYYY)", () => {
    expect(formatDateOnly("1998-03-15")).toBe("15 Mar 1998");
  });

  it("returns an em dash for a missing value", () => {
    expect(formatDateOnly(null)).toBe("—");
    expect(formatDateOnly(undefined)).toBe("—");
    expect(formatDateOnly("")).toBe("—");
  });

  it("returns an em dash for an invalid date string", () => {
    expect(formatDateOnly("not-a-date")).toBe("—");
  });

  describe("timezone safety", () => {
    const originalTZ = process.env.TZ;
    // A timezone behind UTC — the exact condition that rolls a date-only
    // string back a calendar day if it's formatted using local time
    // instead of being pinned to UTC.
    beforeEach(() => { process.env.TZ = "America/Los_Angeles"; });
    afterEach(() => { process.env.TZ = originalTZ; });

    it("does not shift the day backward for a viewer in a timezone behind UTC", () => {
      expect(formatDateOnly("2000-01-01")).toBe("01 Jan 2000");
      expect(formatDateOnly("2026-12-31")).toBe("31 Dec 2026");
    });
  });
});
