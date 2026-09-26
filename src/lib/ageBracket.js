// Live-computed from date_of_birth, never stored — a member's bracket
// updates automatically as they age instead of freezing at whatever it
// was when the record was created or imported.
const BANDS = [
  { max: 12, label: "Children" },
  { max: 19, label: "Teens" },
  { max: 35, label: "Young Adults" },
  { max: Infinity, label: "Other Adults" },
];

/** Whole-years age as of `today`, accounting for whether this year's
 * birthday has happened yet. Returns null for no/invalid/future DOB. */
export function ageInYears(dateOfBirth, today = new Date()) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = today.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hadBirthdayThisYear) age--;
  return age >= 0 ? age : null;
}

/** "Children" | "Teens" | "Young Adults" | "Other Adults" | null. */
export function ageBracket(dateOfBirth, today = new Date()) {
  const age = ageInYears(dateOfBirth, today);
  if (age == null) return null;
  return BANDS.find((b) => age <= b.max).label;
}

/** Same as ageBracket, but "Unknown" instead of null — for direct display. */
export function ageBracketLabel(dateOfBirth, today = new Date()) {
  return ageBracket(dateOfBirth, today) ?? "Unknown";
}
