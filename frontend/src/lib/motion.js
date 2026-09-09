// Shared motion presets. iOS-style: short tweens on opacity/transform only, no overshoot.
export const EASE = [0.25, 0.1, 0.25, 1];

export const tween = (duration = 0.25, delay = 0) => ({ duration, ease: EASE, delay });

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: tween(0.2),
};

export const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: tween(0.25),
};

export const slideX = (dir = 1) => ({
  initial: { opacity: 0, x: 24 * dir },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 * dir },
  transition: tween(0.25),
});

// Firm return-to-rest spring for drag interactions: settles fast, no bounce.
export const SETTLE = { type: "spring", stiffness: 520, damping: 46, mass: 1 };
