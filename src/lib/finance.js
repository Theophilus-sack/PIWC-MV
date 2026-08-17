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
