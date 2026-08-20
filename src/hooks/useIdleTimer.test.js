import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdleTimer } from "./useIdleTimer.js";
import { SESSION_IDLE_TIMEOUT_MS, SESSION_WARNING_DURATION_MS } from "../lib/sessionTimeout.js";

// Compresses the real 25-minute window via fake timers instead of an
// actual live wait — verifies the hook's own warning/timeout/keepAlive
// sequencing, on top of the pure threshold math already covered by
// lib/sessionTimeout.test.js.
describe("useIdleTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows no warning right after mount", () => {
    const { result } = renderHook(() => useIdleTimer(vi.fn()));
    expect(result.current.warning).toBe(false);
  });

  it("shows the warning once idle time reaches the warning threshold", () => {
    const { result } = renderHook(() => useIdleTimer(vi.fn()));
    act(() => {
      vi.advanceTimersByTime(SESSION_IDLE_TIMEOUT_MS - SESSION_WARNING_DURATION_MS + 1000);
    });
    expect(result.current.warning).toBe(true);
  });

  it("calls onTimeout exactly once once idle time reaches the full timeout", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimer(onTimeout));
    act(() => {
      vi.advanceTimersByTime(SESSION_IDLE_TIMEOUT_MS + 2000);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1); // doesn't keep re-firing
  });

  it("keepAlive() dismisses the warning and restarts the clock", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimer(onTimeout));
    act(() => {
      vi.advanceTimersByTime(SESSION_IDLE_TIMEOUT_MS - SESSION_WARNING_DURATION_MS + 1000);
    });
    expect(result.current.warning).toBe(true);

    act(() => {
      result.current.keepAlive();
    });
    expect(result.current.warning).toBe(false);

    // Not enough time has passed since keepAlive() for a fresh timeout.
    act(() => {
      vi.advanceTimersByTime(SESSION_WARNING_DURATION_MS);
    });
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
