// Pure SMS composition/validation logic, kept unit-testable without a live
// Supabase connection or the send-sms Edge Function — mirrors the pattern
// in lib/finance.js.

export const MAX_RECIPIENTS_PER_SEND = 500;

// GSM-7 (the common case for plain-ASCII church SMS bodies): a single
// segment holds 160 chars; once a message needs to be concatenated across
// multiple segments, each segment drops to 153 chars to leave room for the
// concatenation header. This is an approximation (doesn't detect Unicode/
// GSM-7-extended chars that count double) — good enough for a sender-side
// character counter, not billing-accurate.
export function smsSegmentInfo(body) {
  const len = (body ?? "").length;
  if (len === 0) return { length: 0, segments: 0, perSegment: 160 };
  if (len <= 160) return { length: len, segments: 1, perSegment: 160 };
  const segments = Math.ceil(len / 153);
  return { length: len, segments, perSegment: 153 };
}

// Normalizes a Ghanaian number to Arkesel's expected 233XXXXXXXXX shape
// (no leading +, no spaces/dashes). Returns null for anything that isn't
// recognizably a Ghanaian mobile number after normalization, so callers
// can filter/report invalid recipients instead of silently mis-sending.
export function normalizeGhanaPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d]/g, "");
  let n = digits;
  if (n.startsWith("00233")) n = n.slice(2);
  if (n.startsWith("233")) {
    // fall through — already in the target shape
  } else if (n.startsWith("0")) {
    n = "233" + n.slice(1);
  } else if (n.length === 9) {
    // 9 digits with no leading 0/233 — treat as a bare subscriber number
    n = "233" + n;
  } else {
    return null;
  }
  // 233 + 9-digit subscriber number = 12 digits total
  return n.length === 12 ? n : null;
}

/**
 * Validates a compose/send request before it ever reaches the network.
 * Returns { ok: true } or { ok: false, error }. Deliberately does not
 * throw — callers (the send mutation, the compose form) want a message to
 * show the user, not an exception to catch.
 */
export function validateSendRequest({ body, recipients, scheduledAt }) {
  if (!body || !body.trim()) return { ok: false, error: "Message body can't be empty." };
  const count = recipients?.length ?? 0;
  if (count === 0) return { ok: false, error: "Select at least one recipient." };
  if (count > MAX_RECIPIENTS_PER_SEND) {
    return { ok: false, error: `Too many recipients (${count}). Max ${MAX_RECIPIENTS_PER_SEND} per send.` };
  }
  if (scheduledAt) {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid scheduled time." };
    if (when.getTime() <= Date.now()) return { ok: false, error: "Scheduled time must be in the future." };
  }
  return { ok: true };
}

export const SMS_STATUS_LABELS = {
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
  partially_failed: "Partially failed",
};
