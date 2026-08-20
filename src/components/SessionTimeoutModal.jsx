import { createPortal } from "react-dom";
import { formatCountdown } from "../lib/sessionTimeout.js";

// Same portal-to-document.body technique as Modal.jsx, for the same
// reason (avoids getting clipped by an ancestor's backdrop-filter/
// transform) — but deliberately its own component rather than reusing
// Modal's click-outside/Escape-to-dismiss behavior. A security prompt
// like this shouldn't be dismissible by accident; the only way out is
// the explicit "Keep My Session Active" button (or letting it expire).
export function SessionTimeoutModal({ msRemaining, onKeepAlive }) {
  return createPortal(
    <div className="modal-overlay">
      <div className="glass modal-card" style={{ maxWidth: 420, padding: 26, marginTop: "10vh" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 500, marginBottom: 10 }}>
          Your session will expire soon
        </h2>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 4 }}>
          Your session will expire soon due to inactivity. To protect your account, you will be signed out in:
        </p>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 500, textAlign: "center", margin: "14px 0" }}>
          {formatCountdown(msRemaining)}
        </p>
        <button className="btn btn-primary" onClick={onKeepAlive} style={{ width: "100%", height: 44, justifyContent: "center", fontSize: 14 }}>
          Keep My Session Active
        </button>
      </div>
    </div>,
    document.body
  );
}
