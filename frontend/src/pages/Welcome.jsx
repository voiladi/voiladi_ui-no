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

/* Welcome screen, transcribed 1:1 from the reference: logo, wordmark, headline, blurb, two pills, legal line. */
export default function Welcome() {
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col bg-bg px-6 text-center" data-testid="welcome-page">
      <div className="flex flex-1 flex-col items-center justify-center pb-6 pt-8">
        <motion.div {...item(0)}>
          <LogoMark size={76} testId="welcome-logo" />
        </motion.div>
        <motion.div {...item(1)} className="mt-4">
          <Wordmark size={34} testId="welcome-wordmark" />
        </motion.div>

        <motion.h1 {...item(2)} className="mt-14 text-[40px] font-bold leading-[1.1] tracking-[-0.03em] text-ink" data-testid="welcome-headline">
          Connect
          <br />
          with people.
        </motion.h1>
        <motion.p {...item(3)} className="mx-auto mt-5 max-w-[300px] text-[17px] leading-[1.35] tracking-[-0.01em] text-mute" data-testid="welcome-blurb">
          Share your moments, discover new perspectives, and be part of a global community.
        </motion.p>
      </div>

      <motion.div {...item(4)} className="w-full" style={{ paddingBottom: "max(56px, calc(env(safe-area-inset-bottom) + 40px))" }}>
        <button type="button" className="vo-btn-primary h-[50px] w-full text-[17px]" onClick={() => navigate("/signup")} data-testid="welcome-create-account-button">
          Create new account
        </button>
        <button type="button" className="vo-btn mt-4 h-[50px] w-full border border-line bg-surface text-[17px] text-ink hover:bg-surface2" onClick={() => navigate("/login")} data-testid="welcome-login-button">
          Log in
        </button>
        <p className="mx-auto mt-8 max-w-[300px] text-[13px] leading-[1.5] text-mute" data-testid="welcome-legal">
          By creating an account, you agree to our
          <br />
          <button type="button" className="underline decoration-mute/70 underline-offset-2 text-ink2" onClick={() => navigate("/legal/terms")} data-testid="welcome-terms-link">
            Terms of Service
          </button>{" "}
          and{" "}
          <button type="button" className="underline decoration-mute/70 underline-offset-2 text-ink2" onClick={() => navigate("/legal/privacy")} data-testid="welcome-privacy-link">
            Privacy Policy
          </button>
        </p>
      </motion.div>
    </div>
  );
}
