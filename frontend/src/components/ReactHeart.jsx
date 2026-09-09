import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";

/**
 * Heart button placed on a specific photo or prompt. Plays a quick burst, then calls onReact.
 * Stops pointer events from bubbling so it never starts a card drag or a photo-tap.
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
    }, 240);
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.86 }}
      onClick={fire}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={label}
      title={label}
      className={`relative flex ${dims} items-center justify-center rounded-full border border-white/70 bg-white/95 text-brand shadow-[var(--vo-shadow-soft)] backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${className}`}
      data-testid={testId}
    >
      <motion.span animate={burst ? { scale: [1, 1.45, 1] } : { scale: 1 }} transition={{ duration: 0.26, ease: "easeOut" }} className="flex">
        <Heart className={`${icon} ${burst ? "fill-brand" : ""}`} strokeWidth={2.5} />
      </motion.span>
      <AnimatePresence>
        {burst && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-brand"
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
};

/** Small pink pill used in chat / likes to describe a reaction. */
export const ReactionPill = ({ children, className = "", testId }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-semibold text-brand-dark ${className}`} data-testid={testId}>
    <Heart className="h-3 w-3 fill-brand-dark" strokeWidth={2.5} /> {children}
  </span>
);

export const reactionLabel = (reaction, { mine = false, name = "" } = {}) => {
  if (!reaction) return "";
  const what = reaction.type === "photo" ? "photo" : "answer";
  if (mine) return name ? `You liked ${name}'s ${what}` : `You liked their ${what}`;
  return name ? `${name} liked your ${what}` : `Liked your ${what}`;
};
