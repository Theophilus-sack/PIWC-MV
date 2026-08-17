import { describe, it, expect } from "vitest";
import { formatGHS, computeVariance, sumByAssembly } from "./finance.js";

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

describe("sumByAssembly", () => {
  it("sums each assembly's rows across months and produces a grand total", () => {
    const rows = [
      { assembly: "English", budget_ghs: 1000, actual_ghs: 900 },
      { assembly: "English", budget_ghs: 1000, actual_ghs: 1100 },
      { assembly: "Twi", budget_ghs: 500, actual_ghs: 600 },
    ];
    const { byAssembly, total } = sumByAssembly(rows);
    expect(byAssembly.English).toEqual({ budget: 2000, actual: 2000 });
    expect(byAssembly.Twi).toEqual({ budget: 500, actual: 600 });
    expect(total).toEqual({ budget: 2500, actual: 2600 });
  });

  it("still reports a zeroed row for an assembly with no rows yet, rather than omitting it", () => {
    const { byAssembly, total } = sumByAssembly([{ assembly: "English", budget_ghs: 300, actual_ghs: 300 }]);
    expect(byAssembly.Twi).toEqual({ budget: 0, actual: 0 });
    expect(total).toEqual({ budget: 300, actual: 300 });
  });

  it("handles an empty or missing input without throwing", () => {
    expect(sumByAssembly([])).toEqual({
      byAssembly: { English: { budget: 0, actual: 0 }, Twi: { budget: 0, actual: 0 } },
      total: { budget: 0, actual: 0 },
    });
    expect(sumByAssembly(undefined).total).toEqual({ budget: 0, actual: 0 });
  });

  it("ignores a row with an unrecognized assembly value rather than throwing", () => {
    const { total } = sumByAssembly([{ assembly: "French", budget_ghs: 999, actual_ghs: 999 }]);
    expect(total).toEqual({ budget: 0, actual: 0 });
  });
});
