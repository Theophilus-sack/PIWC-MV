// Centralized session-timeout config — one place to change the numbers,
// instead of scattering hardcoded minute counts through components.

export const SESSION_IDLE_TIMEOUT_MS = 25 * 60 * 1000; // sign out after 25 min idle
export const SESSION_WARNING_DURATION_MS = 5 * 60 * 1000; // warn for the final 5 min

export const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

export const SESSION_ACTIVITY_CHANNEL = "piwc-session-activity";
export const SESSION_EXPIRED_STORAGE_KEY = "piwc-session-expired";

/** ms since the given lastActivity timestamp until the warning should show. */
export function msUntilWarning(lastActivity, now = Date.now()) {
  return lastActivity + SESSION_IDLE_TIMEOUT_MS - SESSION_WARNING_DURATION_MS - now;
}

/** ms since the given lastActivity timestamp until the session should time out. */
export function msUntilTimeout(lastActivity, now = Date.now()) {
  return lastActivity + SESSION_IDLE_TIMEOUT_MS - now;
}

/** "4:32" style countdown display — never negative, always mm:ss. */
export function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
