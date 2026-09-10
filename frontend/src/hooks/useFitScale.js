import { useEffect, useState } from "react";

/*
 * Fit-to-device scaling.
 * The screens are authored on a 393 x 852 canvas (the reference mockups). On devices whose viewport is shorter or
 * narrower than that (e.g. Safari with its toolbars, small Androids) the whole shell is laid out on a virtual canvas
 * of (viewport / scale) and scaled down with a transform so every screen keeps the mockup's proportions and fits
 * without scrolling. Desktop (>= 1024px) keeps the centred phone frame at scale 1.
 */
export const DESIGN_W = 393;
export const DESIGN_H = 852;
const MIN_SCALE = 0.78;
const DESKTOP = 1024;

/*
 * fluid = true: the screen is a flexible layout (its content stretches to fill the height), so only the WIDTH
 * decides the scale and the page fills the device height 1:1. Used for Likes / Messages.
 */
const read = (fluid = false) => {
  if (typeof window === "undefined") return { scale: 1, vw: DESIGN_W, vh: DESIGN_H, desktop: false };
  const vv = window.visualViewport;
  const vw = Math.round(vv?.width || window.innerWidth);
  const vh = Math.round(vv?.height || window.innerHeight);
  const desktop = vw >= DESKTOP;
  if (desktop) return { scale: 1, vw, vh, desktop };
  const raw = fluid ? Math.min(vw / DESIGN_W, 1) : Math.min(vw / DESIGN_W, vh / DESIGN_H, 1);
  const scale = Math.max(MIN_SCALE, Math.round(raw * 1000) / 1000);
  return { scale, vw, vh, desktop };
};

const typing = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
};

export const useFitScale = (fluid = false) => {
  const [state, setState] = useState(() => read(fluid));
  useEffect(() => {
    let raf = 0;
    let pending = false;
    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setState(read(fluid)));
    };
    const update = () => {
      // the on-screen keyboard shrinks the viewport while typing: never re-scale mid-typing, catch up on blur
      if (typing()) {
        pending = true;
        return;
      }
      apply();
    };
    const onBlur = () => {
      if (!pending) return;
      pending = false;
      setTimeout(apply, 60);
    };
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    document.addEventListener("focusout", onBlur);
    apply();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      document.removeEventListener("focusout", onBlur);
    };
  }, [fluid]);
  return state;
};

/* Inline style for the shell: virtual canvas size + transform, or nothing on desktop / when no scaling is needed. */
export const shellStyle = ({ scale, vw, vh, desktop }) => {
  if (desktop) return undefined;
  if (scale >= 1) return { width: vw, height: vh, maxWidth: "none" };
  return {
    width: Math.round(vw / scale),
    height: Math.round(vh / scale),
    maxWidth: "none",
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };
};
