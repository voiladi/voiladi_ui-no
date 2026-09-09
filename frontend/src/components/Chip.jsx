import React from "react";
import { Check } from "lucide-react";

export const Chip = ({ active, children, onClick, className = "", icon = true, ...rest }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={!!active}
    className={`vo-chip ${active ? "vo-chip-on" : ""} ${className}`}
    {...rest}
  >
    {active && icon && <Check className="mr-1.5 h-4 w-4" strokeWidth={2.5} />}
    {children}
  </button>
);

/* Small informational tag. Tones are neutral + one tint; "white" is opaque (no backdrop blur: it is used on moving cards). */
export const Tag = ({ children, tone = "default", className = "" }) => {
  const tones = {
    default: "bg-surface2 text-ink",
    tint: "bg-tint-soft text-tint-dark",
    white: "bg-white/95 text-ink",
    dark: "bg-ink/75 text-white",
  };
  return (
    <span className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold ${tones[tone] || tones.default} ${className}`}>
      {children}
    </span>
  );
};
