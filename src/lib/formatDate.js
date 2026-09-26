// Formats a date-only value (e.g. a Postgres `date` column like
// date_of_birth) as en-GB short — "15 Mar 1998" — the same style already
// used elsewhere in the app. `new Date("1998-03-15")` parses as UTC
// midnight; letting toLocaleDateString render that in the *viewer's
// local* timezone can roll it back a day for anyone west of UTC. Pinning
// the formatter's own timeZone to UTC keeps the calendar date exactly
// what was stored, regardless of where the browser thinks it is.
export function formatDateOnly(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
