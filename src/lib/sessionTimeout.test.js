import { describe, it, expect } from "vitest";
import {
  SESSION_IDLE_TIMEOUT_MS, SESSION_WARNING_DURATION_MS,
  msUntilWarning, msUntilTimeout, formatCountdown,
} from "./sessionTimeout.js";

describe("session timeout config", () => {
  it("the warning window is shorter than the full idle timeout", () => {
    expect(SESSION_WARNING_DURATION_MS).toBeLessThan(SESSION_IDLE_TIMEOUT_MS);
  });
});

describe("msUntilWarning / msUntilTimeout", () => {
  it("right after activity, both are in the future", () => {
    const now = 1_000_000;
    expect(msUntilWarning(now, now)).toBeGreaterThan(0);
    expect(msUntilTimeout(now, now)).toBeGreaterThan(0);
  });

  it("warning fires exactly SESSION_WARNING_DURATION_MS before timeout", () => {
    const now = 1_000_000;
    const lastActivity = now - 1000;
    expect(msUntilWarning(lastActivity, now) + SESSION_WARNING_DURATION_MS).toBe(msUntilTimeout(lastActivity, now));
  });

  it("goes negative once the threshold has passed", () => {
    const now = 1_000_000;
    const longAgo = now - SESSION_IDLE_TIMEOUT_MS - 1;
    expect(msUntilTimeout(longAgo, now)).toBeLessThan(0);
  });
});

describe("formatCountdown", () => {
  it("formats whole minutes", () => {
    expect(formatCountdown(5 * 60 * 1000)).toBe("5:00");
  });
  it("pads seconds under 10", () => {
    expect(formatCountdown(4 * 60 * 1000 + 32 * 1000)).toBe("4:32");
    expect(formatCountdown(60 * 1000 + 5 * 1000)).toBe("1:05");
  });
  it("never goes negative — clamps at 0:00", () => {
    expect(formatCountdown(-5000)).toBe("0:00");
  });
  it("rounds up partial seconds so the last second doesn't skip 0:00 early", () => {
    expect(formatCountdown(1200)).toBe("0:02");
  });
});
