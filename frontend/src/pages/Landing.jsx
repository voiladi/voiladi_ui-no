import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { Menu, X, ArrowLeft, ArrowRight, ChevronRight, House, Shapes, Lock, CircleHelp, UserRound } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { SCREENS, Phone, SCREEN_W, SCREEN_H } from "@/components/landing/PhoneScreens";
import { notice } from "@/lib/feedback";

/*
 * voiladi.com - public landing page (guests only).
 * Header + hero + glass store pills + a fanned phone carousel (drag / arrows / dots, spring physics) whose caption
 * changes with the active slide, and a glass side menu opened by the three-line button.
 */

const SPRING = { type: "spring", stiffness: 260, damping: 30, mass: 0.9 };

/* ------------------------------------------------------------------ store pills */

const AppleLogo = ({ className = "" }) => (
  <svg viewBox="0 0 384 512" className={className} aria-hidden="true" fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

const PlayLogo = ({ className = "" }) => (
  <svg viewBox="0 0 48 52" className={className} aria-hidden="true">
    <path d="M2.6 1.2C1.6 2.3 1 4 1 6.2v39.6c0 2.2.6 3.9 1.6 5L24.9 26 2.6 1.2z" fill="#2196F3" />
    <path d="M32.3 33.4 24.9 26 2.6 50.8c1.6 1.7 4.1 1.9 7 .3l22.7-17.7" fill="#F44336" />
    <path d="M32.3 33.4 42.1 27.8c3-1.7 3-4.5 0-6.2l-9.8-5.6L24.9 26l7.4 7.4z" fill="#FFC107" />
    <path d="M32.3 18.6 9.6 .9C6.7-.7 4.2-.5 2.6 1.2L24.9 26l7.4-7.4z" fill="#4CAF50" />
  </svg>
);

const StorePill = ({ kind, small = false, onClick, href, testId }) => {
  const apple = kind === "apple";
  const Tag = href ? "a" : "button";
  return (
    <Tag
      href={href}
      download={href ? "" : undefined}
      type={href ? undefined : "button"}
      onClick={onClick}
      className={`vo-glass-pill inline-flex items-center justify-center gap-2.5 ${small ? "h-[54px] px-3.5" : "h-[clamp(56px,16cqi,68px)] px-[clamp(14px,4.5cqi,22px)]"} text-ink active:scale-[0.97] focus-visible:outline-none`}
      style={{ transitionProperty: "transform", transitionDuration: "120ms" }}
      data-testid={testId}
    >
      {apple ? <AppleLogo className={small ? "h-6 w-6" : "h-[clamp(24px,7cqi,30px)] w-[clamp(24px,7cqi,30px)]"} /> : <PlayLogo className={small ? "h-6 w-6" : "h-[clamp(24px,7cqi,30px)] w-[clamp(24px,7cqi,30px)]"} />}
      <span className="flex flex-col items-start leading-none">
        <span className={`${small ? "text-[9px]" : "text-[clamp(10px,2.9cqi,12.5px)]"} font-medium tracking-[0.01em] text-ink/80`}>{apple ? "Download on the" : "GET IT ON"}</span>
        <span className={`${small ? "mt-0.5 text-[15px]" : "mt-[3px] text-[clamp(17px,5cqi,23px)]"} font-semibold tracking-[-0.02em]`}>{apple ? "App Store" : "Google Play"}</span>
      </span>
    </Tag>
  );
};

const comingSoon = () => notice("Coming soon to the App Store");

/* ------------------------------------------------------------------ carousel */

const wrap = (i, n) => ((i % n) + n) % n;

const PhoneCarousel = ({ index, setIndex, width }) => {
  const n = SCREENS.length;
  const dragX = useMotionValue(0);
  const centerW = Math.round(width * 0.5);
  const sideW = Math.round(width * 0.43);
  const sideShift = Math.round(width * 0.29);
  const height = Math.round((SCREEN_H / SCREEN_W) * centerW) + 16;

  // where each screen sits relative to the active one: -1 left, 0 centre, 1 right, 2 hidden behind
  const slot = (i) => {
    const d = wrap(i - index, n);
    return d === 0 ? 0 : d === 1 ? 1 : d === n - 1 ? -1 : 2;
  };
  // No transform: scale() anywhere - the phones animate their real width, so rounded corners, bezels and the
  // captures are rasterised crisp at every size (scaled layers with overflow clipping render jagged on Android).
  const pose = (s) =>
    s === 0
      ? { x: -centerW / 2, y: 0, width: centerW, rotate: 0, opacity: 1, zIndex: 3 }
      : s === -1
        ? { x: -sideShift - sideW / 2, y: 22, width: sideW, rotate: -6, opacity: 1, zIndex: 2 }
        : s === 1
          ? { x: sideShift - sideW / 2, y: 22, width: sideW, rotate: 6, opacity: 1, zIndex: 2 }
          : { x: -sideW / 2, y: 40, width: sideW, rotate: 0, opacity: 0, zIndex: 1 };

  return (
    <motion.div
      className="relative mx-auto select-none"
      style={{ height, width, touchAction: "pan-y", x: dragX }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.18}
      dragMomentum={false}
      onDragEnd={(e, info) => {
        const swipe = info.offset.x + info.velocity.x * 0.2;
        if (swipe < -60) setIndex(wrap(index + 1, n));
        else if (swipe > 60) setIndex(wrap(index - 1, n));
      }}
      data-testid="landing-carousel"
    >
      {SCREENS.map((s, i) => {
        const sl = slot(i);
        return (
          <motion.div
            key={s.key}
            className="vo-phone-slot absolute left-1/2 top-0"
            style={{ transformOrigin: "50% 60%" }}
            initial={false}
            animate={pose(sl)}
            transition={SPRING}
            onClick={() => sl !== 0 && sl !== 2 && setIndex(i)}
            data-testid={`landing-phone-${s.key}`}
            data-slot={sl}
          >
            <Phone screen={s} priority={i === 0} />
          </motion.div>
        );
      })}
    </motion.div>
  );
};

/* ------------------------------------------------------------------ side menu */

const MENU = [
  { icon: House, title: "About Voiladi", sub: "Our story, vision and mission", to: "/legal/about", testId: "menu-about" },
  { icon: Shapes, title: "Features", sub: "Explore what you can do", to: "#features", testId: "menu-features" },
  { icon: Lock, title: "Safety & Privacy", sub: "A safer, kinder community", to: "/legal/privacy", testId: "menu-safety" },
  { icon: CircleHelp, title: "Help Center", sub: "Find answers and get support", to: "/legal/help", testId: "menu-help" },
];

const SideMenu = ({ open, onClose, go }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.button
          type="button"
          aria-label="Close menu"
          className="vo-landing-backdrop fixed inset-0 z-[200]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          data-testid="landing-menu-backdrop"
        />
        <motion.aside
          className="vo-landing-menu fixed bottom-0 right-0 top-0 z-[201] flex w-[min(86vw,400px)] flex-col"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 32, mass: 0.9 }}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          data-testid="landing-menu"
        >
          <div className="flex items-center justify-between px-6" style={{ paddingTop: "calc(22px + var(--safe-top))" }}>
            <span className="flex items-center gap-3">
              <LogoMark size={52} />
              <span className="text-[32px] font-extrabold leading-none tracking-[-0.035em] text-ink">voiladi</span>
            </span>
            <button type="button" onClick={onClose} className="vo-glass-icon h-[52px] w-[52px]" aria-label="Close" data-testid="landing-menu-close">
              <X className="h-6 w-6" strokeWidth={2.2} />
            </button>
          </div>
          <nav className="mt-9 flex-1 overflow-y-auto px-6">
            {MENU.map(({ icon: Icon, title, sub, to, testId }, i) => (
              <motion.button
                key={title}
                type="button"
                onClick={() => go(to)}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                className="flex w-full items-center gap-4 py-3.5 text-left active:opacity-70 focus-visible:outline-none"
                data-testid={testId}
              >
                <span className="vo-glass-icon h-[58px] w-[58px] shrink-0">
                  <Icon className="h-[24px] w-[24px]" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[19px] font-semibold leading-[23px] tracking-[-0.015em] text-ink">{title}</span>
                  <span className="block text-[14.5px] leading-[19px] text-mute">{sub}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-mute" strokeWidth={2} />
              </motion.button>
            ))}
            <div className="my-3 h-px bg-ink/10" />
            <motion.button
              type="button"
              onClick={() => go("/login")}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex w-full items-center gap-4 py-3.5 text-left active:opacity-70 focus-visible:outline-none"
              data-testid="menu-login"
            >
              <span className="vo-glass-icon h-[58px] w-[58px] shrink-0">
                <UserRound className="h-[24px] w-[24px]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[19px] font-semibold leading-[23px] tracking-[-0.015em] text-ink">Log in</span>
                <span className="block text-[14.5px] leading-[19px] text-mute">Access your account</span>
              </span>
              <ChevronRight className="h-5 w-5 text-mute" strokeWidth={2} />
            </motion.button>
            <motion.div className="mt-6 flex gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36, duration: 0.3 }}>
              <StorePill kind="apple" small onClick={comingSoon} testId="menu-appstore" />
              <StorePill kind="play" small href="/voiladi.apk" testId="menu-playstore" />
            </motion.div>
          </nav>
          <footer className="px-6 pb-8 pt-4 text-center" style={{ paddingBottom: "calc(28px + var(--safe-bottom))" }}>
            <div className="flex items-center justify-center gap-2 text-[13px] text-mute">
              <button type="button" onClick={() => go("/legal/terms")} className="active:opacity-60" data-testid="menu-terms">Terms</button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={() => go("/legal/privacy")} className="active:opacity-60" data-testid="menu-privacy">Privacy</button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={() => go("/legal/guidelines")} className="active:opacity-60" data-testid="menu-guidelines">Community Guidelines</button>
            </div>
            <p className="mt-2 text-[12.5px] text-mute">© 2026 Voiladi. All rights reserved.</p>
          </footer>
        </motion.aside>
      </>
    )}
  </AnimatePresence>
);

/* ------------------------------------------------------------------ page */

export default function Landing() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [menu, setMenu] = useState(false);
  const [frame, setFrame] = useState({ width: 360, padL: 20, padR: 20 });
  const frameRef = useRef(null);
  const featuresRef = useRef(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    // full frame width (padding included) so the fanned phones are centred on the screen, not on the padded column
    const measure = () => {
      const cs = getComputedStyle(el);
      setFrame({ width: Math.min(el.clientWidth, 560), padL: parseFloat(cs.paddingLeft) || 0, padR: parseFloat(cs.paddingRight) || 0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  const go = useCallback(
    (to) => {
      setMenu(false);
      if (to === "#features") {
        setTimeout(() => featuresRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
        return;
      }
      navigate(to);
    },
    [navigate]
  );

  const active = SCREENS[index];
  const n = SCREENS.length;

  return (
    <div className="vo-landing min-h-[100dvh] text-ink" data-testid="landing-page">
      <div ref={frameRef} className="mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col px-[clamp(18px,5.5cqi,28px)]" style={{ containerType: "inline-size" }}>
        {/* header */}
        <header className="flex items-center justify-between" style={{ paddingTop: "calc(18px + var(--safe-top))" }}>
          <span className="flex items-center gap-3" data-testid="landing-brand">
            <LogoMark size={56} />
            <span className="text-[clamp(30px,9cqi,38px)] font-extrabold leading-none tracking-[-0.035em] text-ink">voiladi</span>
          </span>
          <button type="button" onClick={() => setMenu(true)} className="vo-glass-icon h-[clamp(52px,15cqi,62px)] w-[clamp(52px,15cqi,62px)]" aria-label="Open menu" data-testid="landing-menu-button">
            <Menu className="h-[26px] w-[26px]" strokeWidth={2} />
          </button>
        </header>

        {/* hero */}
        <section className="mt-[clamp(16px,5cqi,30px)] text-center">
          <h1 className="mx-auto text-[clamp(40px,12.5cqi,64px)] font-extrabold leading-[0.98] tracking-[-0.045em] text-ink" data-testid="landing-headline">
            A more
            <br />
            human internet.
          </h1>
          <p className="mx-auto mt-[clamp(8px,2.5cqi,14px)] text-[clamp(18px,5.4cqi,26px)] leading-[1.25] tracking-[-0.015em] text-mute" data-testid="landing-subline">
            Chat. Share. Explore. Be real.
            <br />
            All in one place.
          </p>
          <div className="mt-[clamp(18px,5.5cqi,30px)] flex justify-center gap-[clamp(10px,3cqi,16px)]">
            <StorePill kind="apple" onClick={comingSoon} testId="landing-appstore" />
            <StorePill kind="play" href="/voiladi.apk" testId="landing-playstore" />
          </div>
        </section>

        {/* phones */}
        <section ref={featuresRef} id="features" className="mt-[clamp(14px,4cqi,26px)] scroll-mt-4" style={{ marginLeft: -frame.padL, marginRight: -frame.padR }}>
          <PhoneCarousel index={index} setIndex={setIndex} width={frame.width} />
        </section>

        {/* caption */}
        <section className="mt-[clamp(6px,2cqi,14px)] flex items-end justify-between gap-4 pb-2">
          <div className="min-w-0 flex-1">
            <span className="block text-[clamp(14px,4cqi,18px)] font-medium tabular-nums tracking-[0.02em] text-mute" data-testid="landing-counter">
              {String(index + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={active.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
                <h2 className="mt-1 text-[clamp(26px,7.6cqi,38px)] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink" data-testid="landing-slide-title">
                  {active.title}
                </h2>
                <p className="mt-1.5 max-w-[24ch] text-[clamp(15px,4.5cqi,21px)] leading-[1.25] tracking-[-0.01em] text-mute" data-testid="landing-slide-sub">
                  {active.sub}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex shrink-0 items-center gap-3 pb-1">
            <button type="button" onClick={() => setIndex(wrap(index - 1, n))} className="vo-glass-icon h-[clamp(56px,17cqi,72px)] w-[clamp(56px,17cqi,72px)]" aria-label="Previous" data-testid="landing-prev">
              <ArrowLeft className="h-[26px] w-[26px]" strokeWidth={2} />
            </button>
            <button type="button" onClick={() => setIndex(wrap(index + 1, n))} className="vo-landing-next h-[clamp(56px,17cqi,72px)] w-[clamp(56px,17cqi,72px)]" aria-label="Next" data-testid="landing-next">
              <ArrowRight className="h-[26px] w-[26px]" strokeWidth={2.2} />
            </button>
          </div>
        </section>

        {/* dots */}
        <div className="mt-[clamp(8px,3cqi,18px)] flex justify-center gap-3 pb-[calc(28px+var(--safe-bottom))]" data-testid="landing-dots">
          {SCREENS.map((s, i) => (
            <button key={s.key} type="button" onClick={() => setIndex(i)} aria-label={`Go to slide ${i + 1}`} className="flex h-6 w-6 items-center justify-center focus-visible:outline-none" data-testid={`landing-dot-${i}`} data-active={i === index ? "true" : "false"}>
              <motion.span className="block h-[11px] w-[11px] rounded-full" animate={{ backgroundColor: i === index ? "var(--ink)" : "rgba(120,120,128,0.32)", scale: i === index ? 1.12 : 1 }} transition={{ duration: 0.2 }} />
            </button>
          ))}
        </div>
      </div>

      <SideMenu open={menu} onClose={() => setMenu(false)} go={go} />
    </div>
  );
}
