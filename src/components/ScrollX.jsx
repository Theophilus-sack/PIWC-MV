// Reusable horizontal-scroll wrapper. Use around any table, wide grid, or
// other content that can exceed its container's width — a table, a wide
// toolbar, a dense report. Styling lives in the .scroll-x rule in
// styles.css: overflow-x:auto (native scrollbar only appears once content
// actually overflows, so this is a no-op on content that already fits),
// overflow-y:hidden (so it never fights the page's own vertical scroll),
// and a themed scrollbar visible against the app's dark glass surfaces.
//
// Usage: <ScrollX><table className="table">...</table></ScrollX>
export function ScrollX({ children, className = "", style }) {
  return (
    <div className={"scroll-x" + (className ? " " + className : "")} style={style}>
      {children}
    </div>
  );
}
