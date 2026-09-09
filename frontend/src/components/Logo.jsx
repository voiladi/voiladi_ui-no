import React from "react";

/* Black rounded tile with a white bold V (as in the photos). */
export const LogoMark = ({ size = 28, className = "", testId = "logo-mark" }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center bg-ink text-onink ${className}`}
    style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }}
    data-testid={testId}
    aria-hidden="true"
  >
    <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="currentColor">
      <path d="M3.2 4.5h4.4L12 15.1 16.4 4.5h4.4L14.1 19.5H9.9L3.2 4.5z" />
    </svg>
  </span>
);

/* Lowercase wordmark. */
export const Wordmark = ({ size = 20, light = false, className = "", testId = "logo-wordmark" }) => (
  <span
    className={`font-bold leading-none ${light ? "text-white" : "text-ink"} ${className}`}
    style={{ fontSize: size, letterSpacing: "-0.01em" }}
    data-testid={testId}
  >
    voiladi
  </span>
);

/* Header lockup: tile + wordmark. */
export const Brand = ({ size = 28, className = "", testId = "logo" }) => (
  <span className={`inline-flex items-center gap-2 ${className}`} data-testid={testId}>
    <LogoMark size={size} />
    <Wordmark size={Math.round(size * 0.7)} />
  </span>
);

/* Backwards-compatible alias. */
export const Logo = Brand;
