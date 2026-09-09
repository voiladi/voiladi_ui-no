import React, { useState } from "react";
import { Heart } from "lucide-react";

/**
 * Heart button placed on a specific photo or prompt. Fills black on tap, then calls onReact.
 * Stops pointer events from bubbling so it never starts a card drag or a photo-tap.
 * Plain CSS transitions only (no framer) so it stays cheap inside the draggable card.
 */
export const ReactHeart = ({ onReact, label = "Like this", size = "md", className = "", testId }) => {
  const [burst, setBurst] = useState(false);
  const dims = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  const fire = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (burst) return;
    setBurst(true);
    setTimeout(() => {
      onReact?.();
      setBurst(false);
    }, 220);
  };

  return (
    <button
      type="button"
      onClick={fire}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={label}
      title={label}
      className={`relative flex ${dims} items-center justify-center rounded-full bg-white text-ink shadow-soft transition-transform duration-150 ease-ios hover:bg-surface2 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint/40 ${className}`}
      data-testid={testId}
    >
      <Heart
        className={`${icon} transition-transform duration-200 ease-ios ${burst ? "scale-125 fill-ink" : "scale-100"}`}
        strokeWidth={2.25}
      />
    </button>
  );
};

/** Small neutral pill used in chat / likes to describe a reaction. */
export const ReactionPill = ({ children, className = "", testId }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-1 text-[12px] font-semibold text-ink ${className}`} data-testid={testId}>
    <Heart className="h-3 w-3 fill-ink" strokeWidth={2.5} /> {children}
  </span>
);

export const reactionLabel = (reaction, { mine = false, name = "" } = {}) => {
  if (!reaction) return "";
  const what = reaction.type === "photo" ? "photo" : "answer";
  if (mine) return name ? `You liked ${name}'s ${what}` : `You liked their ${what}`;
  return name ? `${name} liked your ${what}` : `Liked your ${what}`;
};
