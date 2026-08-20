import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACTIVITY_EVENTS, SESSION_ACTIVITY_CHANNEL, SESSION_WARNING_DURATION_MS,
  msUntilWarning, msUntilTimeout,
} from "../lib/sessionTimeout.js";

const BROADCAST_THROTTLE_MS = 5000;
const TICK_MS = 1000;

/**
 * Tracks user (in)activity — DOM events in this tab, plus a
 * BroadcastChannel so other same-origin tabs don't drift out of sync and
 * expire a session that's still actively being used elsewhere. The actual
 * threshold math is pure and lives in lib/sessionTimeout.js (unit-tested
 * there); this hook is just the DOM/timer plumbing around it.
 *
 * Once the warning is showing, ordinary activity (mouse move, scroll,
 * etc.) deliberately stops silently resetting the timer — only an
 * explicit keepAlive() call (the modal's "Keep My Session Active" button,
 * or a keep-alive broadcast from another tab) does, matching the spec's
 * flow: warn, then require an explicit confirmation, not just presence.
 */
export function useIdleTimer(onTimeout) {
  const lastActivityRef = useRef(Date.now());
  const warningRef = useRef(false);
  const firedRef = useRef(false);
  const lastBroadcastRef = useRef(0);
  const channelRef = useRef(null);
  const [warning, setWarning] = useState(false);
  const [msRemaining, setMsRemaining] = useState(SESSION_WARNING_DURATION_MS);

  const bump = useCallback((ts) => {
    lastActivityRef.current = ts;
    firedRef.current = false;
    if (warningRef.current) {
      warningRef.current = false;
      setWarning(false);
    }
  }, []);

  const keepAlive = useCallback(() => {
    const ts = Date.now();
    bump(ts);
    channelRef.current?.postMessage({ type: "keep-alive", ts });
  }, [bump]);

  useEffect(() => {
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SESSION_ACTIVITY_CHANNEL) : null;
    channelRef.current = channel;

    const onActivity = () => {
      if (warningRef.current) return; // see comment above: no silent extension once warned
      const now = Date.now();
      bump(now);
      if (channel && now - lastBroadcastRef.current > BROADCAST_THROTTLE_MS) {
        lastBroadcastRef.current = now;
        channel.postMessage({ type: "activity", ts: now });
      }
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    const onMessage = (e) => {
      if (e.data?.type === "activity" || e.data?.type === "keep-alive") bump(e.data.ts ?? Date.now());
    };
    channel?.addEventListener("message", onMessage);

    const interval = setInterval(() => {
      const timeoutIn = msUntilTimeout(lastActivityRef.current);
      if (timeoutIn <= 0) {
        if (!firedRef.current) {
          firedRef.current = true;
          onTimeout();
        }
        return;
      }
      if (!warningRef.current && msUntilWarning(lastActivityRef.current) <= 0) {
        warningRef.current = true;
        setWarning(true);
      }
      if (warningRef.current) setMsRemaining(timeoutIn);
    }, TICK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      channel?.removeEventListener("message", onMessage);
      channel?.close();
      clearInterval(interval);
    };
  }, [bump, onTimeout]);

  return { warning, msRemaining, keepAlive };
}
