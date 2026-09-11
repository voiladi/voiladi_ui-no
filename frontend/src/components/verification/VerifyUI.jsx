import React from "react";
import { ChevronLeft } from "lucide-react";
import { SoftCard } from "@/components/SoftUI";

/*
 * Building blocks for the verification flow, matching the owner's six reference screens 1:1:
 * bare back chevron, centred title + subtitle, big tinted status circle, glass tips card, black bottom CTA.
 */

/* Page frame: back chevron top-left, content, CTA pinned to the bottom (scrolls when the content is taller). */
export const FlowPage = ({ onBack, backTestId, children, cta, testId, ...rest }) => (
  <div className="vo-neu-page flex min-h-full flex-col px-[clamp(16px,5.5cqi,22px)]" style={{ paddingBottom: "calc(22px + env(safe-area-inset-bottom, 0px))" }} data-testid={testId} {...rest}>
    <header className="flex h-[56px] shrink-0 items-center pt-2">
      <button type="button" onClick={onBack} className="-ml-2 flex h-11 w-11 items-center justify-center text-ink active:opacity-60 focus-visible:outline-none" aria-label="Back" data-testid={backTestId}>
        <ChevronLeft className="h-8 w-8" strokeWidth={2.6} />
      </button>
    </header>
    <div className="flex flex-1 flex-col">{children}</div>
    {cta && <div className="mt-8 shrink-0">{cta}</div>}
  </div>
);

export const FlowTitle = ({ children, className = "", testId }) => (
  <h1 className={`text-center text-[clamp(30px,9cqi,36px)] font-bold leading-[1.1] tracking-[-0.03em] text-ink ${className}`} data-testid={testId}>
    {children}
  </h1>
);

export const FlowSub = ({ children, className = "", testId }) => (
  <p className={`mx-auto mt-3 max-w-[320px] text-center text-[clamp(17px,5cqi,19px)] leading-[1.35] tracking-[-0.01em] text-mute ${className}`} data-testid={testId}>
    {children}
  </p>
);

/* Big status circle: neutral (grey), ok (green tint), bad (red tint). */
export const StatusCircle = ({ tone = "neutral", icon: Icon, size = 128, stroke = 2.6, className = "" }) => {
  const tones = {
    neutral: "bg-surface2 text-ink",
    ok: "bg-ok-soft text-ok",
    bad: "bg-red-soft text-red",
  };
  return (
    <span className={`inline-flex items-center justify-center rounded-full ${tones[tone]} ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <Icon style={{ width: size * 0.42, height: size * 0.42 }} strokeWidth={stroke} />
    </span>
  );
};

/* Glass card with icon + label rows ("Good lighting", "No sunglasses", ...). */
export const TipsCard = ({ tips, testId, dense = false }) => (
  <SoftCard className={`rounded-[28px] ${dense ? "px-5 py-3" : "px-5 py-4"}`} testId={testId}>
    {tips.map(({ icon: Icon, label }) => (
      <div key={label} className={`flex items-center gap-5 ${dense ? "py-3" : "py-4"}`}>
        <span className="flex w-[34px] shrink-0 items-center justify-center text-ink">
          <Icon className="h-[30px] w-[30px]" strokeWidth={2} />
        </span>
        <span className="text-[clamp(18px,5.2cqi,20px)] font-medium tracking-[-0.01em] text-ink">{label}</span>
      </div>
    ))}
  </SoftCard>
);

/* Full-width black pill. */
export const FlowButton = ({ children, onClick, disabled, busy, testId }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || busy}
    aria-busy={busy || undefined}
    className="inline-flex h-[58px] w-full items-center justify-center gap-1.5 rounded-full bg-ink text-[clamp(18px,5.2cqi,20px)] font-semibold tracking-[-0.01em] text-onink active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
    style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }}
    data-testid={testId}
  >
    {children}
  </button>
);
