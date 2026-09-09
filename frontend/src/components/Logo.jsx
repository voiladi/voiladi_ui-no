import React from "react";

/* App-icon style mark: ink tile, two rounded strokes that almost meet ("near-connection"). Monochrome. */
export const LogoMark = ({ size = 40, className = "" }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
    <rect width="64" height="64" rx="15" fill="#1D1D1F" />
    <path d="M18 20 L30 44" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
    <path d="M46 20 L36 40" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" opacity="0.55" />
  </svg>
);

export const Wordmark = ({ className = "" }) => (
  <span className={`font-display font-semibold text-ink ${className}`} style={{ letterSpacing: "-0.03em" }}>
    voiladi
  </span>
);

export const Logo = ({ size = 36, wordmark = true, textClass = "text-[22px]" }) => (
  <div className="inline-flex items-center gap-2.5" data-testid="logo">
    <LogoMark size={size} />
    {wordmark && <Wordmark className={textClass} />}
  </div>
);
