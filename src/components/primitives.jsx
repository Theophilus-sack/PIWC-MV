// Small presentational primitives ported from the original components.jsx —
// same implementations, now individually exported ES modules.

export const Logo = ({ size = 28 }) => (
  <div className="brand-mark" style={{ width: size + 8, height: size + 8 }}>
    <img src="/assets/logo-mark.png" alt="" style={{ width: size, height: size }} />
  </div>
);

export const Switch = ({ on, onChange }) => (
  <div className={"switch" + (on ? " on" : "")} onClick={() => onChange(!on)} role="switch" aria-checked={on} />
);

export const Checkbox = ({ checked, onChange }) => (
  <div className={"checkbox" + (checked ? " checked" : "")} onClick={() => onChange(!checked)} role="checkbox" aria-checked={checked} />
);

export const Avatar = ({ initials, gold = false, size = 36 }) => (
  <div className={"avatar" + (gold ? " avatar-gold" : "")} style={{ width: size, height: size, fontSize: size * 0.36 }}>
    {initials}
  </div>
);

// Simple SVG donut chart
export const Donut = ({ data, size = 160, label = "Total" }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg className="donut" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
      {data.map((d, i) => {
        const len = total ? (d.value / total) * c : 0;
        const dash = `${len} ${c - len}`;
        const offset = c * 0.25 - acc;
        acc += len;
        return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth="14" strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="butt" />;
      })}
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize="11" fill="var(--ink-3)" fontFamily="var(--font-sans)">{label}</text>
      <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize="22" fill="var(--ink)" fontFamily="var(--font-display)" fontWeight="500">{total}</text>
    </svg>
  );
};
