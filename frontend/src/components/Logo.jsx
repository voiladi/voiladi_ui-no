import React from "react";

/*
 * The brand mark is the user's own artwork (/logo-mark.png, cropped pixel-exact from the supplied file, corners
 * transparent). It is never redrawn or recoloured. `size` is the rendered width; height keeps the file's aspect.
 */
const MARK_ASPECT = 496 / 525;

export const LogoMark = ({ size = 28, className = "", testId = "logo-mark" }) => {
  const numeric = typeof size === "number";
  return (
    <img
      src="/logo-mark.png"
      alt=""
      draggable={false}
      className={`inline-block shrink-0 select-none ${className}`}
      style={numeric ? { width: size, height: Math.round(size * MARK_ASPECT) } : { width: size, height: "auto" }}
      data-testid={testId}
      aria-hidden="true"
    />
  );
};

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
