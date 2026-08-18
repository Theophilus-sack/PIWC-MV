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

// Members are stored as a single `name` field (no separate first/last
// columns) — split on whitespace the same way the various `initialsOf`
// helpers scattered across pages already do, just exposed here so
// personalization can reuse the same convention.
export function splitName(fullName) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export const TEMPLATE_VARIABLES = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{last_name}}", label: "Last name" },
  { token: "{{full_name}}", label: "Full name" },
  { token: "{{phone}}", label: "Phone" },
  { token: "{{ministry}}", label: "Ministry" },
];

/**
 * Resolves {{first_name}}/{{last_name}}/{{full_name}}/{{phone}}/
 * {{ministry}} against one recipient. Unknown/missing values become an
 * empty string rather than leaving the literal token in the sent
 * message — a blank is a smaller failure than "Dear {{first_name}},".
 */
export function applyTemplateVariables(body, recipient = {}) {
  const { firstName = "", lastName = "", fullName = "", phone = "", ministry = "" } = recipient;
  return (body ?? "")
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{last_name}}", lastName)
    .replaceAll("{{full_name}}", fullName)
    .replaceAll("{{phone}}", phone)
    .replaceAll("{{ministry}}", ministry);
}

export const TEMPLATE_CATEGORIES = [
  { value: "sunday_service", label: "Sunday Service" },
  { value: "prayer_meeting", label: "Prayer Meeting" },
  { value: "youth", label: "Youth" },
  { value: "general_announcement", label: "General Announcement" },
  { value: "birthday", label: "Birthday" },
  { value: "wedding", label: "Wedding" },
  { value: "funeral", label: "Funeral" },
  { value: "emergency", label: "Emergency" },
  { value: "giving", label: "Giving" },
  { value: "follow_up", label: "Follow-up" },
];

/**
 * A member and a manual contact can legitimately share a phone number
 * (e.g. someone who's both). Keeps the first occurrence per normalized
 * phone, drops the rest — so combining Members + Manual Contacts as
 * recipients never sends the same person the same SMS twice.
 */
export function dedupeRecipientsByPhone(recipients) {
  const seen = new Set();
  const deduped = [];
  let duplicatesRemoved = 0;
  for (const r of recipients) {
    const normalized = normalizeGhanaPhone(r.phone) ?? r.phone;
    if (seen.has(normalized)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(normalized);
    deduped.push(r);
  }
  return { recipients: deduped, duplicatesRemoved };
}

export const AUTOMATION_TRIGGER_LABELS = {
  birthday: "Birthday",
  welcome: "Welcome (new member)",
  event_reminder: "Event reminder",
  follow_up: "Follow-up",
};
