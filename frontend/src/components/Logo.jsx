import React from "react";

/*
 * Black rounded tile with the two-stroke "V" from the reference:
 * a white stroke (front, top-left -> bottom) and a light-grey stroke (behind, top-right -> bottom).
 */
export const LogoMark = ({ size = 28, className = "", testId = "logo-mark" }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center bg-ink ${className}`}
    style={{ width: size, height: size, borderRadius: "23.5%" }}
    data-testid={testId}
    aria-hidden="true"
  >
    <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" style={{ display: "block" }}>
      <line x1="71" y1="30" x2="55" y2="64" stroke="#C8CACE" strokeWidth="12.5" strokeLinecap="round" />
      <line x1="29.5" y1="30" x2="48" y2="72" stroke="#FFFFFF" strokeWidth="15.5" strokeLinecap="round" />
    </svg>
  </span>
);

/* Lowercase wordmark. */
export const Wordmark = ({ size = 20, light = false, className = "", testId = "logo-wordmark" }) => (
  <span
    className={`font-extrabold leading-none ${light ? "text-white" : "text-ink"} ${className}`}
    style={{ fontSize: size, letterSpacing: "-0.035em" }}
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
