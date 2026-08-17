import { describe, it, expect } from "vitest";
import { formatGHS, computeVariance } from "./finance.js";

// Intl.NumberFormat inserts a non-breaking space (not U+0020) between the
// currency code and the number, so a hardcoded "GHS 1,234.50" literal
// with an ordinary space fails strict equality despite looking identical.
// Deriving the expected value the same way sidesteps depending on which
// exact whitespace character this environment's ICU data uses.
const ghs = new Intl.NumberFormat("en", { style: "currency", currency: "GHS", minimumFractionDigits: 2 });

describe("formatGHS", () => {
  it("formats a positive amount with the GHS symbol and two decimals", () => {
    expect(formatGHS(1234.5)).toBe(ghs.format(1234.5));
  });
  it("formats zero", () => {
    expect(formatGHS(0)).toBe(ghs.format(0));
  });
  it("returns an em dash for null/undefined", () => {
    expect(formatGHS(null)).toBe("—");
    expect(formatGHS(undefined)).toBe("—");
  });
  it("returns an em dash for non-numeric input", () => {
    expect(formatGHS("not a number")).toBe("—");
  });
});

describe("computeVariance", () => {
  it("actual over budget is a positive amount and percent", () => {
    const { amount, percent } = computeVariance(1200, 1000);
    expect(amount).toBe(200);
    expect(percent).toBe(20);
  });
  it("actual under budget is negative", () => {
    const { amount, percent } = computeVariance(800, 1000);
    expect(amount).toBe(-200);
    expect(percent).toBe(-20);
  });
  it("exactly on budget is zero", () => {
    expect(computeVariance(500, 500)).toEqual({ amount: 0, percent: 0 });
  });
  it("zero budget yields a null percent instead of dividing by zero", () => {
    const { amount, percent } = computeVariance(300, 0);
    expect(amount).toBe(300);
    expect(percent).toBeNull();
  });
  it("treats missing values as zero", () => {
    expect(computeVariance(undefined, undefined)).toEqual({ amount: 0, percent: null });
  });
});
