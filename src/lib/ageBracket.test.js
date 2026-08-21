import { describe, it, expect } from "vitest";
import { ageInYears, ageBracket, ageBracketLabel } from "./ageBracket.js";

const TODAY = new Date("2026-08-21");

describe("ageInYears", () => {
  it("counts a full year only after the birthday has passed this year", () => {
    expect(ageInYears("2000-08-21", TODAY)).toBe(26); // birthday is today
    expect(ageInYears("2000-08-22", TODAY)).toBe(25); // birthday not yet this year
    expect(ageInYears("2000-08-20", TODAY)).toBe(26); // birthday already passed
  });

  it("returns null for no DOB, invalid DOB, or a future DOB", () => {
    expect(ageInYears(null, TODAY)).toBeNull();
    expect(ageInYears(undefined, TODAY)).toBeNull();
    expect(ageInYears("not-a-date", TODAY)).toBeNull();
    expect(ageInYears("2027-01-01", TODAY)).toBeNull();
  });
});

describe("ageBracket boundaries", () => {
  const dobForAge = (age) => {
    const d = new Date(TODAY);
    d.setFullYear(d.getFullYear() - age);
    return d.toISOString().slice(0, 10);
  };

  it("12 is Children, 13 is Teens", () => {
    expect(ageBracket(dobForAge(12), TODAY)).toBe("Children");
    expect(ageBracket(dobForAge(13), TODAY)).toBe("Teens");
  });

  it("19 is Teens, 20 is Young Adults", () => {
    expect(ageBracket(dobForAge(19), TODAY)).toBe("Teens");
    expect(ageBracket(dobForAge(20), TODAY)).toBe("Young Adults");
  });

  it("35 is Young Adults, 36 is Other Adults", () => {
    expect(ageBracket(dobForAge(35), TODAY)).toBe("Young Adults");
    expect(ageBracket(dobForAge(36), TODAY)).toBe("Other Adults");
  });

  it("0 is Children, and there's no upper bound on Other Adults", () => {
    expect(ageBracket(dobForAge(0), TODAY)).toBe("Children");
    expect(ageBracket(dobForAge(100), TODAY)).toBe("Other Adults");
  });
});

describe("ageBracketLabel", () => {
  it("returns 'Unknown' instead of null when there's no DOB", () => {
    expect(ageBracketLabel(null, TODAY)).toBe("Unknown");
    expect(ageBracketLabel(undefined, TODAY)).toBe("Unknown");
  });

  it("matches ageBracket for a real DOB", () => {
    expect(ageBracketLabel("2000-01-01", TODAY)).toBe(ageBracket("2000-01-01", TODAY));
  });
});
