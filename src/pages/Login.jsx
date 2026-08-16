import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { Checkbox } from "../components/primitives.jsx";
import { useAuth } from "../lib/auth.jsx";
import { isSupabaseConfigured } from "../lib/supabaseClient.js";

// Ported from app.jsx's Login component — same markup/design, but now
// actually authenticates against Supabase instead of setLoggedIn(true)
// unconditionally.
export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname ?? "/";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, pw);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Sign in failed. Check your email and password.");
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

          <h1>Welcome back.</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 22 }}>
            Sign in to continue stewarding the family.
          </p>

          {!isSupabaseConfigured && (
            <div className="badge badge-red" style={{ display: "block", marginBottom: 14, padding: "8px 12px" }}>
              Supabase isn't configured yet — copy .env.example to .env.local and add your project URL/anon key.
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Email</label>
              <input className="input" type="email" required autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 14 }}>
              <div className="row between"><label style={{ margin: 0 }}>Password</label></div>
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
                <Checkbox checked={true} onChange={() => {}} />
                <span>Keep me signed in</span>
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
