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
    {active && icon && <Check className="mr-1.5 h-4 w-4" strokeWidth={3} />}
    {children}
  </button>
);

export const Tag = ({ children, tone = "default", className = "" }) => {
  const tones = {
    default: "bg-surface2 text-ink",
    brand: "bg-brand-soft text-brand-dark",
    peach: "bg-peach-soft text-[#B45309]",
    lime: "bg-lime-soft text-[#3F6212]",
    voila: "bg-voila-soft text-voila",
    white: "bg-white/90 text-ink backdrop-blur",
  };
  return (
    <span className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
};
