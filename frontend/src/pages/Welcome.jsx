import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogoMark, Wordmark } from "@/components/Logo";
import { tween, D, EASE_OUT } from "@/lib/motion";

const item = (i) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: tween(D.slow, 0.06 * i, EASE_OUT),
});

/*
 * Welcome screen, transcribed from the reference. Fluid on every device:
 *  - sizes use clamp() so they scale between small phones (320px) and large ones (430px+)
 *  - vertical rhythm is flex-based (logo block ~ upper third, buttons pinned to the lower part)
 *  - respects notches / home indicator via safe-area insets; scrolls instead of clipping on very short screens
 */
export default function Welcome() {
  const navigate = useNavigate();
  const logoSize = "clamp(64px, 18vw, 78px)";
  return (
    <div
      className="flex min-h-full flex-col bg-bg text-center"
      style={{
        paddingLeft: "max(20px, env(safe-area-inset-left))",
        paddingRight: "max(20px, env(safe-area-inset-right))",
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(36px, calc(env(safe-area-inset-bottom) + 24px))",
      }}
      data-testid="welcome-page"
    >
      <div className="flex-[1.15]" aria-hidden="true" />

      <div className="flex flex-col items-center">
        <motion.div {...item(0)} style={{ width: logoSize }}>
          <LogoMark size="100%" testId="welcome-logo" />
        </motion.div>
        <motion.div {...item(1)} className="mt-[clamp(12px,2vh,18px)]">
          <Wordmark size="clamp(28px, 8.6vw, 36px)" testId="welcome-wordmark" />
        </motion.div>

        <motion.h1
          {...item(2)}
          className="mt-[clamp(32px,7vh,64px)] font-bold leading-[1.08] tracking-[-0.03em] text-ink"
          style={{ fontSize: "clamp(32px, 10.2vw, 42px)" }}
          data-testid="welcome-headline"
        >
          Connect
          <br />
          with people.
        </motion.h1>
        <motion.p
          {...item(3)}
          className="mx-auto mt-[clamp(14px,2.4vh,22px)] max-w-[320px] leading-[1.4] tracking-[-0.01em] text-mute"
          style={{ fontSize: "clamp(15px, 4.3vw, 17px)" }}
          data-testid="welcome-blurb"
        >
          Share your moments, discover new perspectives, and be part of a global community.
        </motion.p>
      </div>

      <div className="flex-1 min-h-[28px]" aria-hidden="true" />

      <motion.div {...item(4)} className="mx-auto w-full max-w-[420px]">
        <button type="button" className="vo-btn-primary h-[52px] w-full text-[17px]" onClick={() => navigate("/signup")} data-testid="welcome-create-account-button">
          Create new account
        </button>
        <button
          type="button"
          className="vo-btn mt-3.5 h-[52px] w-full border border-line bg-surface text-[17px] text-ink hover:bg-surface2"
          onClick={() => navigate("/login/email")}
          data-testid="welcome-login-button"
        >
          Log in
        </button>
        <p className="mx-auto mt-[clamp(20px,3.5vh,32px)] max-w-[320px] text-[13px] leading-[1.5] text-mute" data-testid="welcome-legal">
          By creating an account, you agree to our
          <br />
          <button type="button" className="text-ink2 underline decoration-mute/70 underline-offset-2" onClick={() => navigate("/legal/terms")} data-testid="welcome-terms-link">
            Terms of Service
          </button>{" "}
          and{" "}
          <button type="button" className="text-ink2 underline decoration-mute/70 underline-offset-2" onClick={() => navigate("/legal/privacy")} data-testid="welcome-privacy-link">
            Privacy Policy
          </button>
        </p>
      </motion.div>
    </div>
  );
}
