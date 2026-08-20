// Ghana-specific formatting + shared finance math, kept as pure functions
// so they're unit-testable without a live Supabase connection.

const GHS_FORMATTER = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "GHS",
  minimumFractionDigits: 2,
});

export function formatGHS(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  return GHS_FORMATTER.format(Number(amount));
}

export function formatDate(d) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** actual - budget, plus what % over/under budget that represents. */
export function computeVariance(actual, budget) {
  const a = Number(actual) || 0;
  const b = Number(budget) || 0;
  const amount = a - b;
  const percent = b === 0 ? null : Math.round((amount / b) * 10000) / 100;
  return { amount, percent };
}

export const ASSEMBLIES = ["English", "Twi"];

/**
 * Sums a year's worth of {assembly, budget_ghs, actual_ghs} rows into a
 * per-assembly total plus a combined Total row — the shape the "Local
 * Assemblies" and "Variance Analysis" summary tables render directly.
 * Rows for an assembly not yet entered still produce a zeroed row rather
 * than being omitted, so the table always shows both services.
 */
export function sumByAssembly(rows) {
  const totals = Object.fromEntries(ASSEMBLIES.map((a) => [a, { budget: 0, actual: 0 }]));
  for (const r of rows ?? []) {
    if (!totals[r.assembly]) continue;
    totals[r.assembly].budget += Number(r.budget_ghs) || 0;
    totals[r.assembly].actual += Number(r.actual_ghs) || 0;
  }
  const grand = ASSEMBLIES.reduce(
    (acc, a) => ({ budget: acc.budget + totals[a].budget, actual: acc.actual + totals[a].actual }),
    { budget: 0, actual: 0 }
  );
  return { byAssembly: totals, total: grand };
}
