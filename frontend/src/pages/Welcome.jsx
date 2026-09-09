import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, MessageCircle, Heart } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/Logo";

const COVER = "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?crop=entropy&cs=srgb&fm=jpg&q=80&w=1080";

const FEATURES = [
  { icon: Users, label: "Meet genuine people" },
  { icon: MessageCircle, label: "Real conversations" },
  { icon: Heart, label: "Meaningful connections" },
];

/* Two-slide intro: 1) photo splash 2) white welcome. Swipe between them; dots show position. */
export default function Welcome() {
  const navigate = useNavigate();
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const onScroll = () => {
    const el = ref.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (i) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: "smooth" });

  return (
    <div className="relative h-full" data-testid="welcome-page">
      <div ref={ref} onScroll={onScroll} className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto">
        {/* 1. Splash */}
        <section className="relative h-full w-full shrink-0 snap-center" data-testid="splash-slide">
          <img src={COVER} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="relative flex h-full flex-col items-center px-5 pb-8 pt-[22vh] text-center">
            <LogoMark size={72} className="shadow-modal" testId="splash-logo" />
            <Wordmark size={34} light className="mt-4" testId="splash-wordmark" />
            <div className="mt-auto">
              <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-white" data-testid="splash-headline">
                Good people.
                <br />
                Better connections.
              </h1>
              <Dots idx={idx} onPick={go} light />
            </div>
            <div className="mt-6 w-full space-y-2.5">
              <button type="button" className="vo-btn h-12 w-full bg-white text-ink" onClick={() => navigate("/signup")} data-testid="splash-create-account-button">
                Create account
              </button>
              <button type="button" className="vo-btn h-12 w-full border border-white/30 bg-black/35 text-white" onClick={() => navigate("/login")} data-testid="splash-login-button">
                Log in
              </button>
            </div>
          </div>
        </section>

        {/* 2. Welcome */}
        <section className="relative flex h-full w-full shrink-0 snap-center flex-col items-center bg-bg px-5 pb-6 pt-[16vh] text-center" data-testid="welcome-slide">
          <LogoMark size={72} testId="welcome-logo" />
          <Wordmark size={30} className="mt-4" testId="welcome-wordmark" />
          <p className="mt-3 text-[16px] leading-snug text-mute">
            Good people.
            <br />
            Better connections.
          </p>
          <ul className="mt-10 space-y-5 text-left" data-testid="welcome-features">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-4 text-[15px] font-medium text-ink">
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                {label}
              </li>
            ))}
          </ul>
          <div className="mt-auto w-full">
            <Dots idx={idx} onPick={go} />
            <div className="mt-4 space-y-2.5">
              <button type="button" className="vo-btn-primary w-full" onClick={() => navigate("/signup")} data-testid="welcome-create-account-button">
                Create account
              </button>
              <button type="button" className="vo-btn-secondary w-full" onClick={() => navigate("/login")} data-testid="welcome-login-button">
                Log in
              </button>
            </div>
            <p className="mt-4 px-6 text-[12px] leading-relaxed text-mute">
              By continuing, you agree to our <button type="button" className="text-blue" onClick={() => navigate("/legal/terms")} data-testid="welcome-terms-link">Terms of Service</button> and{" "}
              <button type="button" className="text-blue" onClick={() => navigate("/legal/privacy")} data-testid="welcome-privacy-link">Privacy Policy</button>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

const Dots = ({ idx, onPick, light = false }) => (
  <div className="mt-4 flex items-center justify-center gap-1.5" data-testid="welcome-dots">
    {[0, 1].map((i) => (
      <button
        key={i}
        type="button"
        aria-label={`Slide ${i + 1}`}
        onClick={() => onPick(i)}
        className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${i === idx ? "w-1.5" : "w-1.5"} ${
          light ? (i === idx ? "bg-white" : "bg-white/40") : i === idx ? "bg-ink" : "bg-line"
        }`}
      />
    ))}
  </div>
);
