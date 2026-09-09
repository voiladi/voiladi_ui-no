// Shared motion presets: short fades/slides on opacity + transform only.
export const EASE = [0.2, 0.8, 0.2, 1];
export const EASE_OUT = [0.16, 1, 0.3, 1];

export const D = { fast: 0.15, base: 0.22, slow: 0.32 };

export const tween = (duration = D.base, delay = 0, ease = EASE) => ({ duration, ease, delay });

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: tween(D.base),
};

export const rise = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: tween(D.base),
};

export const slideX = (dir = 1) => ({
  initial: { opacity: 0, x: 24 * dir },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 * dir },
  transition: tween(D.base),
});

// Firm return-to-rest for drag interactions: settles quickly, no bounce.
export const SETTLE = { type: "spring", stiffness: 520, damping: 48, mass: 1 };
