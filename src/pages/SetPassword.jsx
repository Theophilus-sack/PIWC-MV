import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { supabase } from "../lib/supabaseClient.js";

// Where an invite email's link lands (see useInviteUser's redirectTo) —
// and, now, also where a "forgot password" reset link lands (Login.jsx's
// ForgotPasswordCard). Supabase's client auto-detects the access_token in
// the URL hash and establishes a session before this component even
// mounts, for both flows identically — the only difference is which
// auth event fired (PASSWORD_RECOVERY for a reset link vs. a plain
// sign-in event for an invite), which just changes the copy below.
// Public route, same as Login — reachable regardless of auth state,
// because a fresh invite/recovery session isn't "authenticated enough" yet.
export function SetPassword() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Couldn't set your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="ambient"><div className="orb" /></div>
      <div className="grain" />
      <div className="login">
        <div className="glass login-card fade-in">
          <div className="row" style={{ gap: 12, marginBottom: 22 }}>
            <div className="brand-mark" style={{ width: 44, height: 44 }}>
              <img src="/assets/logo-mark.png" alt="" style={{ width: 28, height: 28 }} />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, lineHeight: 1.1 }}>PIWC Mountain View</div>
              <div className="eyebrow" style={{ marginTop: 2 }}>Church management</div>
            </div>
          </div>

          {loading ? (
            <p className="muted">{isRecovery ? "Checking your reset link…" : "Checking your invite…"}</p>
          ) : !session ? (
            <>
              <h1>Link expired</h1>
              <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                {isRecovery
                  ? "This reset link is no longer valid — reset links expire after a while. Request a new one from the Login page."
                  : "This invite link is no longer valid — invite links expire after a while. Ask your Super Admin or Pastor to send a new one from the Admin page."}
              </p>
            </>
          ) : (
            <>
              <h1>{isRecovery ? "Reset your password" : "Set your password"}</h1>
              <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 22 }}>
                {isRecovery ? "Choose a new password for your account." : "Choose a password to finish setting up your account."}
              </p>
              <form onSubmit={onSubmit}>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>New password</label>
                  <input className="input" type="password" required autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Confirm password</label>
                  <input className="input" type="password" required autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
                {error && (
                  <div className="badge badge-red" style={{ display: "block", marginBottom: 14, padding: "8px 12px" }}>
                    {error}
                  </div>
                )}
                <button className="btn btn-primary" type="submit" disabled={submitting}
                  style={{ width: "100%", height: 44, justifyContent: "center", fontSize: 14 }}>
                  {submitting ? "Saving…" : "Set password & continue"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
