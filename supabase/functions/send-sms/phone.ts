// Deliberately duplicated from src/lib/sms.js rather than imported: Edge
// Functions deploy as a self-contained unit (`supabase functions deploy`
// only ships this directory), so it can't reach into ../../../src across
// the Vite/Deno boundary. Keep in sync with normalizeGhanaPhone in
// src/lib/sms.js if the phone-normalization rules ever change — both are
// covered by src/lib/sms.test.js's behavior, just not by a shared import.

export function normalizeGhanaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d]/g, "");
  let n = digits;
  if (n.startsWith("00233")) n = n.slice(2);
  if (n.startsWith("233")) {
    // fall through — already in the target shape
  } else if (n.startsWith("0")) {
    n = "233" + n.slice(1);
  } else if (n.length === 9) {
    n = "233" + n;
  } else {
    return null;
  }
  return n.length === 12 ? n : null;
}
