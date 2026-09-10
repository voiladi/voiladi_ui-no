import React from "react";

/* Pill chip. Off: grey surface. On: ink with white text. */
export const Chip = ({ active, children, onClick, className = "", ...rest }) => (
  <button type="button" onClick={onClick} aria-pressed={!!active} className={`vo-chip ${active ? "vo-chip-on" : ""} ${className}`} {...rest}>
    {children}
  </button>
);

/* Small tag. `glass` sits on photos; `surface` on white. */
export const Tag = ({ children, tone = "surface", className = "" }) => {
  if (tone === "glass") return <span className={`vo-chip-glass ${className}`}>{children}</span>;
  return <span className={`inline-flex h-[30px] items-center rounded-full bg-surface px-3 text-[13px] font-medium text-ink ${className}`}>{children}</span>;
};

/* Segmented control. `dark` = active segment is ink (Filters "Show me"); default = white pill with shadow (Likes tabs). */
export const Segmented = ({ options, value, onChange, render, testIdPrefix = "segment", dark = false, fit = false, className = "" }) => (
  <div
    className={`vo-seg ${fit ? "vo-seg-fit" : ""} ${className}`}
    style={fit ? undefined : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    role="tablist"
    data-testid={`${testIdPrefix}-track`}
  >
    {options.map((o) => {
      const key = typeof o === "string" ? o : o.value;
      const label = render ? render(o) : typeof o === "string" ? o : o.label;
      const active = key === value;
      return (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={active}
          data-testid={`${testIdPrefix}-${String(key).toLowerCase().replace(/\s+/g, "-")}`}
          onClick={() => onChange(key)}
          className={`vo-seg-item ${active ? (dark ? "vo-seg-on-dark" : "vo-seg-on") : ""}`}
        >
          {label}
        </button>
      );
    })}
  </div>
);
