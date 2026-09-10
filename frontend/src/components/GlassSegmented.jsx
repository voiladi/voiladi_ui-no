import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";

/*
 * Liquid-glass segmented control (iOS 26 style).
 *  - Tap a segment: the pill glides over with a spring.
 *  - Press and hold anywhere on the track: the pill LIFTS into a translucent glass lens (bigger, blurred, bright rim)
 *    and follows the finger left/right; labels light up as it passes over them; release snaps to the nearest one
 *    with a jelly bounce. Vertical page scrolling still works (touch-action: pan-y).
 *  - Same options/value/onChange/testIdPrefix contract as <Segmented/>.
 */
const PAD = 4; // track padding (matches .vo-seg-lg)
const SNAP = { type: "spring", stiffness: 520, damping: 40, mass: 0.9 };
const JELLY = { type: "spring", stiffness: 420, damping: 16, mass: 0.8 };

const haptic = () => {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(6);
  } catch (e) {
    /* ignore */
  }
};

export const GlassSegmented = ({ options, value, onChange, testIdPrefix = "segment", className = "" }) => {
  const trackRef = useRef(null);
  const n = options.length;
  const keyOf = (o) => (typeof o === "string" ? o : o.value);
  const labelOf = (o) => (typeof o === "string" ? o : o.label);
  const index = Math.max(0, options.findIndex((o) => keyOf(o) === value));

  const [segW, setSegW] = useState(0);
  const [lifted, setLifted] = useState(false);
  const [hover, setHover] = useState(index); // segment currently under the lens while dragging
  const x = useMotionValue(0);
  const scale = useMotionValue(1);
  const drag = useRef(null);

  // measure the track (also on resize / fit-scale changes)
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const measure = () => setSegW((el.clientWidth - PAD * 2) / n);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n]);

  // keep the pill on the selected segment when value / size change (no animation on first layout)
  const first = useRef(true);
  useEffect(() => {
    if (!segW || drag.current) return;
    const target = index * segW;
    if (first.current) {
      first.current = false;
      x.set(target);
    } else {
      animate(x, target, SNAP);
    }
    setHover(index);
  }, [index, segW, x]);

  const clampRubber = useCallback(
    (v) => {
      const max = (n - 1) * segW;
      if (v < 0) return v * 0.28;
      if (v > max) return max + (v - max) * 0.28;
      return v;
    },
    [n, segW]
  );

  const onPointerDown = (e) => {
    if (!segW || e.button > 0) return;
    const el = trackRef.current;
    el.setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, startX: e.clientX, startPill: x.get(), scale: 1, moved: false };
    setLifted(true);
    animate(scale, 1.08, { type: "spring", stiffness: 500, damping: 30 });
    haptic();
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = (e.clientX - d.startX) / d.scale;
    if (Math.abs(dx) > 3) d.moved = true;
    if (!d.moved) return;
    const nx = clampRubber(d.startPill + dx);
    x.set(nx);
    const h = Math.min(n - 1, Math.max(0, Math.round(nx / segW)));
    if (h !== hover) {
      setHover(h);
      haptic();
    }
  };

  const finish = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    let target = index;
    if (d.moved) {
      target = Math.min(n - 1, Math.max(0, Math.round(x.get() / segW)));
    } else {
      // plain tap: segment under the pointer
      const rect = trackRef.current.getBoundingClientRect();
      const local = (e.clientX - rect.left) / d.scale - PAD;
      target = Math.min(n - 1, Math.max(0, Math.floor(local / segW)));
    }
    setLifted(false);
    animate(scale, 1, JELLY);
    animate(x, target * segW, d.moved ? JELLY : SNAP);
    setHover(target);
    const key = keyOf(options[target]);
    if (key !== value) onChange(key);
  };

  const onPointerCancel = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setLifted(false);
    animate(scale, 1, JELLY);
    animate(x, index * segW, SNAP);
    setHover(index);
  };

  const onKeyDown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = Math.min(n - 1, Math.max(0, index + (e.key === "ArrowRight" ? 1 : -1)));
    if (next !== index) onChange(keyOf(options[next]));
  };

  const activeIdx = lifted ? hover : index;

  return (
    <div
      ref={trackRef}
      role="tablist"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={onPointerCancel}
      className={`vo-gseg ${lifted ? "is-lifted" : ""} ${className}`}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, touchAction: "pan-y" }}
      data-testid={`${testIdPrefix}-track`}
      data-lifted={lifted || undefined}
    >
      <motion.div
        aria-hidden="true"
        className="vo-gseg-thumb"
        style={{ width: segW || `calc((100% - ${PAD * 2}px) / ${n})`, x, scale }}
        data-testid={`${testIdPrefix}-thumb`}
      />
      {options.map((o, i) => {
        const key = keyOf(o);
        const active = i === activeIdx;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            tabIndex={-1}
            aria-selected={i === index}
            data-testid={`${testIdPrefix}-${String(key).toLowerCase().replace(/\s+/g, "-")}`}
            className={`vo-gseg-item ${active ? "is-active" : ""}`}
            style={{ transform: lifted && active ? "scale(1.06)" : "scale(1)" }}
          >
            {labelOf(o)}
          </button>
        );
      })}
    </div>
  );
};
