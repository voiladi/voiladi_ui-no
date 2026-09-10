import React from "react";
import { motion } from "framer-motion";
import { Brand } from "@/components/Logo";
import { rise } from "@/lib/motion";

/*
 * Soft-UI building blocks for the Likes / Messages tabs (as photographed):
 * raised light surfaces on the canvas, 44px round icon buttons, big rounded empty card with 3D art.
 */

/* Header: 40px brand tile + wordmark on the left, round raised icon buttons on the right. */
export const SoftHeader = ({ right }) => (
  <div className="flex h-[56px] items-center justify-between">
    <Brand size={40} />
    {right && <div className="flex items-center gap-3">{right}</div>}
  </div>
);

export const SoftIconButton = ({ icon: Icon, label, onClick, testId, active = false, strokeWidth = 2, children, ...rest }) => (
  <button type="button" className="vo-soft-icon" onClick={onClick} aria-label={label} aria-pressed={active || undefined} data-testid={testId} {...rest}>
    {Icon ? <Icon className="h-[22px] w-[22px]" strokeWidth={strokeWidth} /> : children}
  </button>
);

/* Large title + grey subtitle; optional element aligned to the right of the block (e.g. the heart-count pill). */
export const SoftTitle = ({ title, subtitle, right, testId }) => (
  <div className="mt-2 flex items-center justify-between gap-3">
    <div className="min-w-0">
      <h1 className="text-[34px] font-bold leading-[38px] tracking-[-0.025em] text-ink" data-testid={testId}>
        {title}
      </h1>
      <p className="mt-1 text-[17px] leading-[22px] tracking-[-0.01em] text-mute">{subtitle}</p>
    </div>
    {right}
  </div>
);

/* Empty state: big rounded card that fills the space down to the floating nav. */
export const SoftEmpty = ({ art, title, description, actionIcon: ActionIcon, actionLabel, onAction, footer, actionTestId, testId = "empty-state" }) => (
  <motion.section {...rise} className="vo-soft-lg mx-5 mt-4 flex flex-1 flex-col items-center justify-center rounded-[34px] px-5 py-8 text-center" data-testid={testId}>
    <div className="relative h-[198px] w-[220px]" aria-hidden="true">
      {art}
    </div>
    <h2 className="mt-7 text-[22px] font-bold leading-[28px] tracking-[-0.02em] text-ink">{title}</h2>
    <p className="mt-1.5 max-w-[280px] text-[17px] leading-[23px] tracking-[-0.01em] text-mute">{description}</p>
    {actionLabel && (
      <button type="button" className="vo-soft-btn mt-8 max-w-[330px]" onClick={onAction} data-testid={actionTestId}>
        {ActionIcon && <ActionIcon className="h-6 w-6" strokeWidth={2.2} />}
        {actionLabel}
      </button>
    )}
    {footer && <p className="mt-6 text-[16px] leading-[20px] text-mute">{footer}</p>}
  </motion.section>
);

/* Art: two soft chat bubbles, the front one with three dots. Filter regions are oversized so shadows never clip to a box. */
export const BubblesArt = () => (
  <svg viewBox="0 0 200 180" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
    <defs>
      <linearGradient id="vo-bub-front" x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0" style={{ stopColor: "var(--soft-art-hi)" }} />
        <stop offset="1" style={{ stopColor: "var(--soft-art-lo)" }} />
      </linearGradient>
      <linearGradient id="vo-bub-back" x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0" style={{ stopColor: "var(--soft-art-back-hi)" }} />
        <stop offset="1" style={{ stopColor: "var(--soft-art-back-lo)" }} />
      </linearGradient>
      <filter id="vo-bub-shadow" x="-70%" y="-70%" width="240%" height="260%" colorInterpolationFilters="sRGB">
        <feDropShadow dx="-7" dy="-7" stdDeviation="7" floodColor="#ffffff" floodOpacity="1" />
        <feDropShadow dx="12" dy="14" stdDeviation="12" style={{ floodColor: "var(--soft-art-shadow)" }} floodOpacity="0.14" />
        <feDropShadow dx="3" dy="4" stdDeviation="3" style={{ floodColor: "var(--soft-art-shadow)" }} floodOpacity="0.05" />
      </filter>
      <filter id="vo-bub-shadow-soft" x="-70%" y="-70%" width="240%" height="260%" colorInterpolationFilters="sRGB">
        <feDropShadow dx="-5" dy="-5" stdDeviation="6" floodColor="#ffffff" floodOpacity="0.9" />
        <feDropShadow dx="8" dy="10" stdDeviation="10" style={{ floodColor: "var(--soft-art-shadow)" }} floodOpacity="0.09" />
      </filter>
    </defs>
    {/* back bubble (upper right), tail bottom-right */}
    <g filter="url(#vo-bub-shadow-soft)">
      <path d="M128 12C162 12 190 36 190 66C190 82 183 96 172 106L182 130L152 116C144 119 136 120 128 120C94 120 66 96 66 66C66 36 94 12 128 12Z" fill="url(#vo-bub-back)" />
    </g>
    {/* front bubble (lower left), tail bottom-left */}
    <g filter="url(#vo-bub-shadow)">
      <path d="M78 54C115 54 144 78 144 108C144 138 115 162 78 162C66 162 55 160 45 155L24 170L34 148C20 138 12 124 12 108C12 78 41 54 78 54Z" fill="url(#vo-bub-front)" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.2" />
    </g>
    <circle cx="58" cy="108" r="6" fill="var(--soft-art-dot)" />
    <circle cx="78" cy="108" r="6" fill="var(--soft-art-dot)" />
    <circle cx="98" cy="108" r="6" fill="var(--soft-art-dot)" />
  </svg>
);

/* Art: two stacked soft cards, the front one with a grey heart. */
export const CardsArt = () => (
  <svg viewBox="0 0 200 180" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
    <defs>
      <linearGradient id="vo-card-front" x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0" style={{ stopColor: "var(--soft-art-hi)" }} />
        <stop offset="1" style={{ stopColor: "var(--soft-art-lo)" }} />
      </linearGradient>
      <linearGradient id="vo-card-back" x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0" style={{ stopColor: "var(--soft-art-back-hi)" }} />
        <stop offset="1" style={{ stopColor: "var(--soft-art-back-lo)" }} />
      </linearGradient>
      <linearGradient id="vo-heart-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#B4B4B9" />
        <stop offset="1" stopColor="#6F6F74" />
      </linearGradient>
      <filter id="vo-card-shadow" x="-70%" y="-70%" width="240%" height="260%" colorInterpolationFilters="sRGB">
        <feDropShadow dx="-7" dy="-7" stdDeviation="7" floodColor="#ffffff" floodOpacity="1" />
        <feDropShadow dx="12" dy="14" stdDeviation="12" style={{ floodColor: "var(--soft-art-shadow)" }} floodOpacity="0.14" />
        <feDropShadow dx="3" dy="4" stdDeviation="3" style={{ floodColor: "var(--soft-art-shadow)" }} floodOpacity="0.05" />
      </filter>
      <filter id="vo-card-shadow-soft" x="-70%" y="-70%" width="240%" height="260%" colorInterpolationFilters="sRGB">
        <feDropShadow dx="-5" dy="-5" stdDeviation="6" floodColor="#ffffff" floodOpacity="0.9" />
        <feDropShadow dx="8" dy="10" stdDeviation="10" style={{ floodColor: "var(--soft-art-shadow)" }} floodOpacity="0.09" />
      </filter>
    </defs>
    <g filter="url(#vo-card-shadow-soft)" transform="rotate(-14 84 76)">
      <rect x="26" y="18" width="116" height="116" rx="26" fill="url(#vo-card-back)" />
    </g>
    <g filter="url(#vo-card-shadow)" transform="rotate(6 112 100)">
      <rect x="50" y="38" width="124" height="124" rx="28" fill="url(#vo-card-front)" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.2" />
      <g transform="translate(112 100) scale(2.4) translate(-12 -11)">
        <path d="M12 21s-1.2-.9-2.8-2.2C5.2 15.5 1 12.2 1 7.6 1 4.4 3.5 2 6.6 2c1.9 0 3.7.9 4.9 2.4L12 5l.5-.6C13.7 2.9 15.5 2 17.4 2 20.5 2 23 4.4 23 7.6c0 4.6-4.2 7.9-8.2 11.2C13.2 20.1 12 21 12 21z" fill="url(#vo-heart-grad)" />
      </g>
    </g>
  </svg>
);
