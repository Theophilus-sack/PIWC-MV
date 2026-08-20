import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { useIdleTimer } from "../hooks/useIdleTimer.js";
import { SESSION_EXPIRED_STORAGE_KEY } from "../lib/sessionTimeout.js";
import { SessionTimeoutModal } from "./SessionTimeoutModal.jsx";

// Mounted only inside AppShell (i.e. only for authenticated routes — see
// App.jsx), so it naturally doesn't run on the public Login/SetPassword
// pages. On real timeout it signs the user out via the actual Supabase
// session (not just a visual redirect) — AuthProvider's onAuthStateChange
// then flips isAuthenticated false, which ProtectedRoute already handles
// by redirecting to /login with the page they were on preserved
// (state:{from: location}), so "return to the page they were using" comes
// for free from existing routing code.
export function SessionTimeoutWatcher() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const onTimeout = useCallback(async () => {
    sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, "1");
    await signOut();
    navigate("/login", { replace: true });
  }, [signOut, navigate]);

  const { warning, msRemaining, keepAlive } = useIdleTimer(onTimeout);

  if (!warning) return null;
  return <SessionTimeoutModal msRemaining={msRemaining} onKeepAlive={keepAlive} />;
}
