import React from "react";
import { motion } from "framer-motion";
import { EASE } from "@/lib/motion";

export const CompatibilityRing = ({ value = 0, size = 56, stroke = 4, className = "", dark = false }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full ${dark ? "bg-ink/70" : "bg-white"} ${className}`}
      style={{ width: size, height: size }}
      data-testid="compatibility-ring"
      title={`${pct}% match`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? "rgba(255,255,255,0.22)" : "#E8E8ED"} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={dark ? "#FFFFFF" : "#2B4C7E"}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </svg>
      <span className={`absolute font-display font-semibold tabular-nums ${dark ? "text-white" : "text-ink"}`} style={{ fontSize: size * 0.27 }}>
        {pct}%
      </span>
    </div>
  );
};
