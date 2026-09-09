import React from "react";

/*
 * Loading primitives (Instagram-style):
 *  - Spinner: thin ring with a gap, spinning. Inherits text colour.
 *  - PageLoader: centred spinner for a whole screen / section.
 *  - Skeleton*: soft shimmering placeholders shaped like the content they replace.
 */

export const Spinner = ({ size = 22, stroke = 2, className = "", testId = "spinner" }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      className={`vo-spin shrink-0 ${className}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      role="status"
      aria-label="Loading"
      data-testid={testId}
    >
      <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={stroke} strokeOpacity="0.18" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * 0.72} ${c}`}
      />
    </svg>
  );
};

/* Full-area loader. `label` is for screen readers only. */
export const PageLoader = ({ className = "", size = 30, testId = "page-loader" }) => (
  <div className={`flex w-full flex-1 items-center justify-center py-24 text-ink ${className}`} data-testid={testId}>
    <Spinner size={size} stroke={2.5} />
  </div>
);

/* Overlay loader that dims and blocks the screen underneath (e.g. while finishing sign-up). */
export const BlockingLoader = ({ show, testId = "blocking-loader" }) =>
  show ? (
    <div className="absolute inset-0 z-40 flex items-center justify-center backdrop-blur-[2px]" style={{ background: "rgba(255,255,255,0.7)" }} data-testid={testId} aria-busy="true">
      <Spinner size={30} stroke={2.5} className="text-ink" />
    </div>
  ) : null;

export const Skeleton = ({ className = "", style, testId = "loading-skeleton" }) => <div className={`vo-shimmer rounded-[12px] ${className}`} style={style} data-testid={testId} aria-hidden="true" />;

/* Avatar + two lines + trailing block (Likes / Chat rows). */
export const SkeletonRow = ({ avatar = 60, className = "" }) => (
  <div className={`flex items-center gap-3.5 py-3 ${className}`} aria-hidden="true" data-testid="loading-skeleton">
    <Skeleton className="shrink-0 rounded-full" style={{ width: avatar, height: avatar }} />
    <div className="min-w-0 flex-1 space-y-2.5">
      <Skeleton className="h-4 w-2/5 rounded-full" />
      <Skeleton className="h-3.5 w-4/5 rounded-full" />
    </div>
    <Skeleton className="h-3 w-8 rounded-full" />
  </div>
);

export const SkeletonList = ({ rows = 5, avatar = 60, className = "" }) => (
  <div className={className} data-testid="loading-skeleton-list">
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonRow key={i} avatar={avatar} />
    ))}
  </div>
);

/* Lines of text. */
export const SkeletonLines = ({ lines = 3, className = "" }) => (
  <div className={`space-y-2.5 ${className}`} aria-hidden="true" data-testid="loading-skeleton">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-3.5 rounded-full ${i === lines - 1 ? "w-3/5" : "w-full"}`} />
    ))}
  </div>
);
