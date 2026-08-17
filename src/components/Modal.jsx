import { useEffect } from "react";
import { createPortal } from "react-dom";

// Renders into document.body via a portal instead of wherever the caller
// happens to sit in the component tree. This isn't a style choice — it's
// what actually fixes the class of bug we kept hitting: a modal nested
// inside a `.glass` card (or anything else with backdrop-filter/filter/
// transform) gets a new CSS containing block imposed on it, which traps a
// `position: fixed` overlay inside that ancestor's box instead of the true
// viewport, and gets clipped by the ancestor's overflow. A portal makes
// the DOM placement independent of the React tree entirely, so it no
// longer matters which card, table, or tab a modal is invoked from — this
// bit us twice already (FinancePage, GroupsPage) before the JSX was
// nested correctly, and a portal makes it structurally impossible to hit
// again anywhere in the app, not just in the places already audited.
//
// Callers own everything inside the overlay — pass a `.glass modal-card`
// (or a custom variant, like Groups' scrollable add-to-roster list) as
// children; Modal only owns the portal, the backdrop, click-outside-to-
// close, and Escape-to-close.
export function Modal({ onClose, children }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      {children}
    </div>,
    document.body
  );
}
