import React from "react";

/*
 * Black rounded tile with the two-stroke "V" from the reference:
 * a white stroke (front, top-left -> bottom) and a light-grey stroke (behind, top-right -> bottom).
 */
export const LogoMark = ({ size = 28, className = "", testId = "logo-mark" }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center bg-ink ${className}`}
    style={{ width: size, height: size, borderRadius: Math.round(size * 0.27) }}
    data-testid={testId}
    aria-hidden="true"
  >
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none">
      <line x1="68" y1="31" x2="46" y2="71" stroke="#BFC2C9" strokeWidth="11" strokeLinecap="round" />
      <line x1="32" y1="31" x2="52" y2="71" stroke="#FFFFFF" strokeWidth="13" strokeLinecap="round" />
    </svg>
  </span>
);

/* Lowercase wordmark. */
export const Wordmark = ({ size = 20, light = false, className = "", testId = "logo-wordmark" }) => (
  <span
    className={`font-bold leading-none ${light ? "text-white" : "text-ink"} ${className}`}
    style={{ fontSize: size, letterSpacing: "-0.02em" }}
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
