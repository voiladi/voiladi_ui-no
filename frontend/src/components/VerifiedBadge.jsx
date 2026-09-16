import React from "react";
import { Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

/*
 * The black tick. Tapping it explains what it means ("Verified Profile").
 * size: px of the circle. `onLight` = badge sits on a photo (adds a white ring so it reads on any picture).
 */
/* Plain (non-interactive) tick for use inside buttons/links, where a nested <button> would be invalid HTML. */
export const VerifiedMark = ({ size = 16, className = "", testId = "verified-mark" }) => (
  <span
    role="img"
    aria-label="Verified"
    className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink text-onink ${className}`}
    style={{ width: size, height: size }}
    data-testid={testId}
  >
    <Check style={{ width: size * 0.62, height: size * 0.62 }} strokeWidth={3.2} />
  </span>
);

export const VerifiedBadge = ({ size = 20, onPhoto = false, className = "", testId = "verified-badge", inline = false }) => inline ? (
  <VerifiedMark size={size} className={className} testId={testId} />
) : (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label="Verified Profile"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink text-onink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue active:scale-95 ${onPhoto ? "ring-2 ring-white/90" : ""} ${className}`}
        style={{ width: size, height: size, transitionProperty: "transform", transitionDuration: "120ms" }}
        data-testid={testId}
      >
        <Check style={{ width: size * 0.62, height: size * 0.62 }} strokeWidth={3.2} />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={8} className="vo-apple z-[120] w-[260px] rounded-[18px] border-0 bg-transparent p-0 shadow-none" data-testid="verified-popover">
      <div className="vo-soft-lg rounded-[18px] px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-onink">
            <Check className="h-4 w-4" strokeWidth={3.2} />
          </span>
          <span className="text-[16px] font-bold tracking-[-0.01em] text-ink">Verified Profile</span>
        </div>
        <p className="mt-2 text-[13.5px] leading-[18px] text-mute">This person confirmed they're real with a live selfie that was checked by the Voiladi team.</p>
      </div>
    </PopoverContent>
  </Popover>
);
