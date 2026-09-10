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
  <div className="mt-3 flex items-center justify-between gap-3">
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
  <motion.section {...rise} className="vo-soft-lg mx-5 mt-5 flex flex-1 flex-col items-center justify-center rounded-[28px] px-5 py-8 text-center" data-testid={testId}>
    <div className="relative h-[190px] w-[240px]" aria-hidden="true">
      {art}
    </div>
    <h2 className="mt-8 text-[24px] font-bold leading-[30px] tracking-[-0.02em] text-ink">{title}</h2>
    <p className="mt-2 max-w-[300px] text-[17px] leading-[24px] tracking-[-0.01em] text-mute">{description}</p>
    {actionLabel && (
      <button type="button" className="vo-soft-btn mt-8 max-w-[330px]" onClick={onAction} data-testid={actionTestId}>
        {ActionIcon && <ActionIcon className="h-6 w-6" strokeWidth={2.2} />}
        {actionLabel}
      </button>
    )}
    {footer && <p className="mt-6 text-[16px] leading-[20px] text-mute">{footer}</p>}
  </motion.section>
);

/* Art: two soft chat bubbles, the front one with three dots. */
export const BubblesArt = () => (
  <svg width="240" height="190" viewBox="0 0 240 190" className="absolute inset-0" aria-hidden="true">
    <defs>
      <linearGradient id="vo-bub-front" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" style={{ stopColor: "var(--soft-art-hi)" }} />
        <stop offset="1" style={{ stopColor: "var(--soft-art-lo)" }} />
      </linearGradient>
      <linearGradient id="vo-bub-back" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" style={{ stopColor: "var(--soft-art-lo)" }} />
        <stop offset="1" style={{ stopColor: "var(--soft-art-hi)" }} />
      </linearGradient>
      <filter id="vo-bub-shadow" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#111111" floodOpacity="0.12" />
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#111111" floodOpacity="0.05" />
      </filter>
      <filter id="vo-bub-shadow-soft" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#111111" floodOpacity="0.07" />
      </filter>
    </defs>
    {/* back bubble, tail bottom-right */}
    <g filter="url(#vo-bub-shadow-soft)">
      <path d="M156 7C199 7 234 35 234 69C234 88 226 105 212 117L228 142L194 127C182 130 169 131 156 131C113 131 78 103 78 69C78 35 113 7 156 7Z" fill="url(#vo-bub-back)" />
    </g>
    {/* front bubble, tail bottom-left */}
    <g filter="url(#vo-bub-shadow)">
      <path d="M100 40C153 40 196 74 196 116C196 158 153 192 100 192C80 192 62 188 48 181L24 191L37 167C17 153 4 136 4 116C4 74 47 40 100 40Z" fill="url(#vo-bub-front)" />
      <path d="M100 40C153 40 196 74 196 116C196 158 153 192 100 192C80 192 62 188 48 181L24 191L37 167C17 153 4 136 4 116C4 74 47 40 100 40Z" fill="none" style={{ stroke: "var(--soft-art-edge)" }} strokeWidth="1.5" />
    </g>
    <circle cx="72" cy="116" r="8" fill="var(--soft-art-dot)" />
    <circle cx="100" cy="116" r="8" fill="var(--soft-art-dot)" />
    <circle cx="128" cy="116" r="8" fill="var(--soft-art-dot)" />
  </svg>
);

/* Art: two stacked soft cards, the front one with a grey heart. */
export const CardsArt = () => (
  <>
    <span className="vo-art-card vo-art-card-back" />
    <span className="vo-art-card vo-art-card-front flex items-center justify-center">
      <svg width="72" height="66" viewBox="0 0 24 22" aria-hidden="true">
        <defs>
          <linearGradient id="vo-heart-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#B0B0B6" />
            <stop offset="1" stopColor="#6B6B70" />
          </linearGradient>
        </defs>
        <path d="M12 21s-1.2-.9-2.8-2.2C5.2 15.5 1 12.2 1 7.6 1 4.4 3.5 2 6.6 2c1.9 0 3.7.9 4.9 2.4L12 5l.5-.6C13.7 2.9 15.5 2 17.4 2 20.5 2 23 4.4 23 7.6c0 4.6-4.2 7.9-8.2 11.2C13.2 20.1 12 21 12 21z" fill="url(#vo-heart-grad)" />
      </svg>
    </span>
  </>
);
