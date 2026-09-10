import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { animate, motion, useMotionValue } from "framer-motion";
import { Search, Heart, MessageCircle, User } from "lucide-react";
import { useBadges } from "@/hooks/useBadges";

/*
 * Floating tab bar as photographed (iPhone reference):
 *  - white raised pill, inset from the edges
 *  - Discover = two overlapping squares, the front one SOLID black when active
 *  - active: black icon + bold black label; inactive: grey outline icon + grey label
 *  - liquid-glass lens: slides to the tab you tap (fades in, glides, fades out) and, if you press and hold,
 *    lifts into a glass pill that follows your finger; release snaps to the nearest tab and opens it.
 */
const DiscoverIcon = ({ active, className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinejoin="round" aria-hidden="true">
    {/* back card */}
    <path d="M14.5 6.5V5.2A2.2 2.2 0 0 0 12.3 3H5.2A2.2 2.2 0 0 0 3 5.2v7.1a2.2 2.2 0 0 0 2.2 2.2h1.3" />
    {/* front card */}
    <rect x="9" y="9" width="12" height="12" rx="2.4" fill={active ? "currentColor" : "none"} />
  </svg>
);

const TABS = [
  { to: "/discover", label: "Discover", id: "discover", icon: DiscoverIcon, custom: true },
  { to: "/explore", label: "Explore", id: "explore", icon: Search, fill: false },
  { to: "/likes", label: "Likes", id: "likes", icon: Heart, fill: true },
  { to: "/chats", label: "Chat", id: "chats", icon: MessageCircle, fill: true },
  { to: "/profile", label: "Profile", id: "profile", icon: User, fill: true },
];

const PAD = 4;
const SNAP = { type: "spring", stiffness: 520, damping: 40, mass: 0.9 };
const JELLY = { type: "spring", stiffness: 420, damping: 16, mass: 0.8 };

const shellScale = () => {
  const el = typeof document !== "undefined" ? document.querySelector("[data-fit-scale]") : null;
  const s = el ? parseFloat(el.getAttribute("data-fit-scale")) : 1;
  return Number.isFinite(s) && s > 0 ? s : 1;
};

const haptic = () => {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(6);
  } catch (e) {
    /* ignore */
  }
};

export const BottomNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { likes, unread } = useBadges();
  const n = TABS.length;
  const index = Math.max(0, TABS.findIndex((t) => pathname.startsWith(t.to)));

  const barRef = useRef(null);
  const [segW, setSegW] = useState(0);
  const [lifted, setLifted] = useState(false);
  const [hover, setHover] = useState(index);
  const x = useMotionValue(0);
  const scale = useMotionValue(1);
  const lensOpacity = useMotionValue(0);
  const drag = useRef(null);
  const fade = useRef(null);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return undefined;
    const measure = () => setSegW((el.clientWidth - PAD * 2) / n);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n]);

  // glide to the active tab when the route changes: lens appears, slides, then fades away
  const first = useRef(true);
  useEffect(() => {
    if (!segW || drag.current) return;
    const target = index * segW;
    if (first.current) {
      first.current = false;
      x.set(target);
      return;
    }
    clearTimeout(fade.current);
    animate(lensOpacity, 1, { duration: 0.12 });
    animate(x, target, SNAP);
    fade.current = setTimeout(() => animate(lensOpacity, 0, { duration: 0.35 }), 420);
    setHover(index);
  }, [index, segW, x, lensOpacity]);

  const clampRubber = (v) => {
    const max = (n - 1) * segW;
    if (v < 0) return v * 0.28;
    if (v > max) return max + (v - max) * 0.28;
    return v;
  };

  const onPointerDown = (e) => {
    if (!segW || e.button > 0) return;
    barRef.current.setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, startX: e.clientX, startPill: x.get(), scale: shellScale(), moved: false, t: Date.now() };
    // press: bring the lens under the finger's tab right away
    const rect = barRef.current.getBoundingClientRect();
    const local = (e.clientX - rect.left) / drag.current.scale - PAD;
    const under = Math.min(n - 1, Math.max(0, Math.floor(local / segW)));
    x.set(under * segW);
    drag.current.startPill = under * segW;
    setHover(under);
    clearTimeout(fade.current);
    animate(lensOpacity, 1, { duration: 0.1 });
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
    const target = d.moved ? Math.min(n - 1, Math.max(0, Math.round(x.get() / segW))) : hover;
    setLifted(false);
    animate(scale, 1, JELLY);
    animate(x, target * segW, d.moved ? JELLY : SNAP);
    setHover(target);
    clearTimeout(fade.current);
    fade.current = setTimeout(() => animate(lensOpacity, 0, { duration: 0.35 }), 380);
    if (target !== index) navigate(TABS[target].to);
  };

  const onPointerCancel = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setLifted(false);
    animate(scale, 1, JELLY);
    animate(x, index * segW, SNAP);
    animate(lensOpacity, 0, { duration: 0.3 });
    setHover(index);
  };

  const activeIdx = lifted ? hover : index;

  return (
    <nav data-testid="bottom-nav" className="absolute inset-x-3 z-30" style={{ bottom: "calc(var(--nav-gap) + env(safe-area-inset-bottom, 0px))" }}>
      <div
        ref={barRef}
        role="tablist"
        aria-label="Main"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={onPointerCancel}
        className={`vo-float-nav vo-gseg-nav relative grid rounded-[32px] ${lifted ? "is-lifted" : ""}`}
        style={{ height: "var(--nav-h)", gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, padding: PAD, touchAction: "none" }}
        data-lifted={lifted || undefined}
      >
        <motion.div aria-hidden="true" className="vo-gseg-thumb vo-gseg-thumb-nav" style={{ width: segW || `calc((100% - ${PAD * 2}px) / ${n})`, x, scale, opacity: lensOpacity }} data-testid="bottom-nav-lens" />
        {TABS.map((t, i) => {
          const active = i === activeIdx;
          const Icon = t.icon;
          const badge = t.id === "likes" ? likes : t.id === "chats" ? unread : 0;
          return (
            <a
              key={t.to}
              href={t.to}
              role="tab"
              aria-selected={i === index}
              aria-current={i === index ? "page" : undefined}
              aria-label={badge > 0 ? `${t.label}, ${badge} new` : t.label}
              data-testid={`bottom-nav-${t.id}`}
              onClick={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(t.to);
                }
              }}
              onDragStart={(e) => e.preventDefault()}
              draggable={false}
              className={`relative z-10 flex h-full flex-col items-center justify-center gap-[5px] rounded-[26px] focus-visible:outline-none ${active ? "text-ink" : "text-[color:var(--nav-idle)]"}`}
              style={{ transition: "color 160ms cubic-bezier(0.2,0.8,0.2,1), transform 160ms cubic-bezier(0.2,0.8,0.2,1)", transform: lifted && active ? "scale(1.06)" : "scale(1)" }}
            >
              <span className="relative">
                {t.custom ? <Icon active={active} className="h-[26px] w-[26px]" /> : <Icon className="h-[26px] w-[26px]" strokeWidth={active ? 2.2 : 1.9} fill={active && t.fill ? "currentColor" : "none"} />}
                {badge > 0 && <span data-testid={`bottom-nav-${t.id}-badge`} className="absolute -right-1 -top-0.5 h-[9px] w-[9px] rounded-full bg-red ring-2 ring-[color:var(--soft-bg)]" />}
              </span>
              <span className={`text-[13px] leading-none tracking-[-0.01em] ${active ? "font-bold" : "font-medium"}`}>{t.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
};
