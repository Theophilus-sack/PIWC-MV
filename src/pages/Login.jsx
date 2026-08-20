import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { Checkbox } from "../components/primitives.jsx";
import { useAuth } from "../lib/auth.jsx";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { SESSION_EXPIRED_STORAGE_KEY } from "../lib/sessionTimeout.js";

const REMEMBERED_EMAIL_KEY = "piwc-remembered-email";

// Ported from app.jsx's Login component — same markup/design, but now
// actually authenticates against Supabase instead of setLoggedIn(true)
// unconditionally.
export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "");
  const [rememberEmail, setRememberEmail] = useState(true);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [expiredNotice, setExpiredNotice] = useState(false);
  const [mode, setMode] = useState("sign-in"); // "sign-in" | "reset"

  const from = location.state?.from?.pathname ?? "/";

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_EXPIRED_STORAGE_KEY)) {
      setExpiredNotice(true);
      sessionStorage.removeItem(SESSION_EXPIRED_STORAGE_KEY);
    }
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, pw);
      if (rememberEmail) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Sign in failed. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === "reset") {
    return <ForgotPasswordCard email={email} onBack={() => setMode("sign-in")} />;
  }

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

          <h1>Welcome back.</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 22 }}>
            Sign in to continue stewarding the family.
          </p>

          {!isSupabaseConfigured && (
            <div className="badge badge-red" style={{ display: "block", marginBottom: 14, padding: "8px 12px" }}>
              Supabase isn't configured yet — copy .env.example to .env.local and add your project URL/anon key.
            </div>
          )}

          {expiredNotice && (
            <div className="badge badge-red" style={{ display: "block", marginBottom: 14, padding: "8px 12px" }}>
              Your session expired due to inactivity. Please sign in again.
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Email</label>
              <input className="input" type="email" required autoComplete="username" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 14 }}>
              <div className="row between">
                <label style={{ margin: 0 }}>Password</label>
                <button type="button" className="faint" style={{ background: "none", border: "none", fontSize: 12.5, cursor: "pointer", padding: 0 }} onClick={() => setMode("reset")}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input className="input" type={show ? "text" : "password"} required autoComplete="current-password"
                  value={pw} onChange={(e) => setPw(e.target.value)} style={{ paddingRight: 38 }} />
                <button type="button" className="btn btn-icon btn-ghost" style={{ position: "absolute", right: 4, top: 4 }} onClick={() => setShow((s) => !s)}>
                  <Icon name="eye" size={14} />
                </button>
              </div>
            </div>

            <div className="row between" style={{ marginBottom: 18 }}>
              <label className="row" style={{ gap: 8, fontSize: 13, cursor: "pointer" }}>
                <Checkbox checked={rememberEmail} onChange={setRememberEmail} />
                <span>Remember my email on this device</span>
              </label>
            </div>

            {error && (
              <div className="badge badge-red" style={{ display: "block", marginBottom: 14, padding: "8px 12px" }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={submitting}
              style={{ width: "100%", height: 44, justifyContent: "center", fontSize: 14 }}>
              {submitting ? "Signing in…" : "Sign in to dashboard"}
            </button>
          </form>

          <div className="divider" />
          <p className="faint" style={{ fontSize: 11.5, textAlign: "center", margin: 0 }}>
            Protected by role-based access · v1.0 MVP
          </p>
        </div>
      </div>
    </>
  );
}

// The emailed reset link lands on the existing /set-password page (built
// for invite links) — Supabase's recovery flow establishes a session the
// same way an invite does, so auth.updateUser({password}) there already
// does exactly what's needed. No new route.
function ForgotPasswordCard({ email: initialEmail, onBack }) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err.message || "Couldn't send a reset link. Try again.");
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

          {sent ? (
            <>
              <h1>Check your email.</h1>
              <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 22 }}>
                If an account exists for {email}, a reset link is on its way.
              </p>
            </>
          ) : (
            <>
              <h1>Reset your password.</h1>
              <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 22 }}>
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={onSubmit}>
                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Email</label>
                  <input className="input" type="email" required autoFocus autoComplete="username"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {error && (
                  <div className="badge badge-red" style={{ display: "block", marginBottom: 14, padding: "8px 12px" }}>
                    {error}
                  </div>
                )}
                <button className="btn btn-primary" type="submit" disabled={submitting}
                  style={{ width: "100%", height: 44, justifyContent: "center", fontSize: 14 }}>
                  {submitting ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}

          <div className="divider" />
          <button type="button" className="faint" style={{ background: "none", border: "none", fontSize: 12.5, cursor: "pointer", padding: 0, display: "block", margin: "0 auto" }} onClick={onBack}>
            ← Back to sign in
          </button>
        </div>
      </div>
    </>
  );
}
