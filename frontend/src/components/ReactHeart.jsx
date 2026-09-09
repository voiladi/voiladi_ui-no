import React, { useState } from "react";
import { Heart } from "lucide-react";

/** Heart control on a specific photo or prompt. White disc; fills red on tap, then calls onReact. */
export const ReactHeart = ({ onReact, label = "Like this", size = "md", className = "", testId }) => {
  const [sent, setSent] = useState(false);
  const dims = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";

  const fire = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (sent) return;
    setSent(true);
    setTimeout(() => {
      onReact?.();
      setSent(false);
    }, 420);
  };

  return (
    <button
      type="button"
      onClick={fire}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={label}
      title={label}
      className={`relative flex ${dims} items-center justify-center rounded-full bg-white text-ink shadow-action transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue ${className}`}
      data-testid={testId}
    >
      <Heart className={`${icon} ${sent ? "text-red" : ""}`} fill={sent ? "currentColor" : "none"} strokeWidth={2} />
    </button>
  );
};

/** Small pill used in chat / likes to describe a reaction. */
export const ReactionPill = ({ children, className = "", testId }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-ink ${className}`} data-testid={testId}>
    <Heart className="h-3 w-3 text-red" fill="currentColor" strokeWidth={2} /> {children}
  </span>
);

export const reactionLabel = (reaction, { mine = false, name = "" } = {}) => {
  if (!reaction) return "";
  const what = reaction.type === "photo" ? "photo" : "answer";
  if (mine) return name ? `You liked ${name}'s ${what}` : `You liked their ${what}`;
  return name ? `${name} liked your ${what}` : `Liked your ${what}`;
};
