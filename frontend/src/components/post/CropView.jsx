import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { layoutCrop, cssFilter, overlayStyle, clamp, MAX_ZOOM } from "@/lib/imageEdit";

/*
 * Instagram-style crop box: the photo covers a box of the chosen aspect; drag to move, pinch to zoom.
 * `crop.aspect === null` is "Original": the whole photo fits inside a square with letterbox bars (no pan / zoom).
 * Pointer events only (works for mouse + touch); a 3x3 grid fades in while you're adjusting.
 */
export const CropView = ({ src, iw, ih, crop, onChange, filterId = "normal", adjust, interactive = true, className = "", rounded = "", testId = "crop-view" }) => {
  const ref = useRef(null);
  const [box, setBox] = useState({ W: 0, H: 0 });
  const [active, setActive] = useState(false);
  const ptrs = useRef(new Map());
  const start = useRef(null);
  const fit = !crop?.aspect;
  const aspect = fit ? 1 : clamp(crop.aspect, 0.8, 1.91);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setBox({ W: el.clientWidth, H: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  const lay = !fit && box.W && iw && ih ? layoutCrop(crop, iw, ih, box.W, box.H) : null;

  const toNorm = (ox, oy, l) => ({
    nx: l.dw - box.W < 1 ? 0 : clamp(ox / ((l.dw - box.W) / 2), -1, 1),
    ny: l.dh - box.H < 1 ? 0 : clamp(oy / ((l.dh - box.H) / 2), -1, 1),
  });

  const snapshot = () => {
    const pts = [...ptrs.current.values()];
    const c = pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
    const d = pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    start.current = { crop: { ...crop }, c, d, lay: layoutCrop(crop, iw, ih, box.W, box.H) };
  };

  const onDown = (e) => {
    if (!interactive || fit || !lay) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snapshot();
    setActive(true);
  };

  const onMove = (e) => {
    if (!interactive || fit || !start.current || !ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    const s = start.current;
    let next = { ...s.crop };
    let l = s.lay;
    let c;
    if (pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      next.zoom = clamp((s.crop.zoom || 1) * (d / (s.d || d)), 1, MAX_ZOOM);
      l = layoutCrop(next, iw, ih, box.W, box.H);
      c = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    } else {
      c = pts[0];
    }
    const ox = s.lay.ox * (l.dw - box.W) / Math.max(1, s.lay.dw - box.W) + (c.x - s.c.x);
    const oy = s.lay.oy * (l.dh - box.H) / Math.max(1, s.lay.dh - box.H) + (c.y - s.c.y);
    next = { ...next, ...toNorm(ox, oy, l) };
    onChange?.(next);
  };

  const onUp = (e) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size === 0) {
      start.current = null;
      setActive(false);
    } else {
      // one finger lifted from a pinch: rebase on the remaining finger
      start.current = null;
      setTimeout(() => ptrs.current.size && snapshot(), 0);
    }
  };

  useEffect(() => () => ptrs.current.clear(), []);

  const filter = cssFilter(filterId, adjust);
  const overlay = overlayStyle(adjust);

  return (
    <div
      ref={ref}
      className={`relative w-full select-none overflow-hidden bg-black ${rounded} ${className}`}
      style={{ aspectRatio: String(aspect), touchAction: interactive && !fit ? "none" : "auto", cursor: interactive && !fit ? (active ? "grabbing" : "grab") : "default" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      data-testid={testId}
      data-mode={fit ? "fit" : "crop"}
    >
      {fit ? (
        <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-contain" style={{ filter: filter || undefined }} />
      ) : lay ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-0 top-0 max-w-none"
          style={{ width: lay.dw, height: lay.dh, transform: `translate3d(${lay.left}px, ${lay.top}px, 0)`, filter: filter || undefined, willChange: "transform" }}
        />
      ) : null}
      {overlay && <div className="pointer-events-none absolute inset-0" style={overlay} aria-hidden="true" />}
      {/* rule-of-thirds grid while adjusting */}
      {!fit && interactive && (
        <div className="pointer-events-none absolute inset-0" style={{ opacity: active ? 1 : 0, transitionProperty: "opacity", transitionDuration: "180ms" }} aria-hidden="true">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/55" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/55" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/55" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/55" />
        </div>
      )}
    </div>
  );
};
