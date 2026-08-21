// Mirrors the exact formula in 0020_member_profile_extended.sql's
// set_member_id() trigger: 'PIWC-' + year(date_joined) + '-' + the
// globally-sequential nextval(), zero-padded to at least 4 digits.
//
// NOT used by any runtime code path — member IDs are always generated
// server-side by the trigger, never computed client-side. This exists
// purely so the "bulk import spanning multiple join-years produces
// globally unique, monotonically increasing IDs regardless of year"
// requirement has a real, passing test without a live Postgres instance
// (this project's test setup has never had one — see phase2_rls.test.js's
// documented limitation). True concurrent-insert atomicity is guaranteed
// by Postgres's own nextval() semantics, not something re-verifiable
// here; a live spot-check after applying 0020 is the equivalent of every
// prior migration's manual-verification step.
export function formatMemberId(year, sequenceNumber) {
  return `PIWC-${year}-${String(sequenceNumber).padStart(4, "0")}`;
}
