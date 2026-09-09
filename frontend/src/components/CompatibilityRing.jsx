import React from "react";
import { motion } from "framer-motion";

export const CompatibilityRing = ({ value = 0, size = 56, stroke = 5, className = "", dark = false }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 75 ? "#FF2D75" : pct >= 50 ? "#0A84FF" : "#FFB020";
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full ${dark ? "bg-[rgba(11,18,32,0.82)]" : "bg-white"} ${className}`}
      style={{ width: size, height: size }}
      data-testid="compatibility-ring"
      title={`${pct}% match`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? "rgba(255,255,255,0.18)" : "#EEF1F6"} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
        />
      </svg>
      <span
        className={`absolute font-display font-bold ${dark ? "text-white" : "text-ink"}`}
        style={{ fontSize: size * 0.28 }}
      >
        {pct}%
      </span>
    </div>
  );
};
