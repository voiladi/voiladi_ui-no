import React from "react";

export const LogoMark = ({ size = 40, className = "" }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
    <rect width="64" height="64" rx="19" fill="#0A0A0F" />
    <path d="M17 19 L29.5 45" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
    <path d="M47 19 L36.5 41" stroke="#FF2D75" strokeWidth="9" strokeLinecap="round" />
  </svg>
);

export const Wordmark = ({ className = "" }) => (
  <span className={`font-display font-extrabold text-ink ${className}`} style={{ letterSpacing: "-0.04em" }}>
    voiladi
  </span>
);

export const Logo = ({ size = 36, wordmark = true, textClass = "text-[22px]" }) => (
  <div className="inline-flex items-center gap-2.5" data-testid="logo">
    <LogoMark size={size} />
    {wordmark && <Wordmark className={textClass} />}
  </div>
);
