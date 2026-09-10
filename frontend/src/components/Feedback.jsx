import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { subscribeFeedback, dismissNotice, dismissBanner } from "@/lib/feedback";
import { UserPhoto } from "@/components/UserPhoto";
import { LogoMark } from "@/components/Logo";

/*
 * Renders in-app feedback INSIDE the phone shell so it always sits within the app frame:
 *  - NoticeBar: thin glass bar above the tab bar (errors / must-know messages only).
 *  - Banner: iOS notification-style glass banner at the top (new match / new message). Tap to open.
 * Both use the Apple text stack (see .vo-apple in index.css).
 */
export const FeedbackLayer = ({ nav = false }) => {
  const [fb, setFb] = useState({ notice: null, banner: null });
  useEffect(() => subscribeFeedback(setFb), []);
  const n = fb.notice;
  const b = fb.banner;

  return (
    <>
      <AnimatePresence>
        {n && (
          <motion.div
            key={n.id}
            role="status"
            aria-live="polite"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className={`vo-notice ${nav ? "vo-notice-nav" : ""}`}
            onClick={dismissNotice}
            data-testid="notice-bar"
          >
            {n.text}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {b && (
          <motion.button
            key={b.id}
            type="button"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.6, bottom: 0.05 }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -24 || info.velocity.y < -300) dismissBanner();
            }}
            onClick={() => {
              dismissBanner();
              b.onClick?.();
            }}
            className="vo-ios-banner"
            data-testid={b.testId}
          >
            <span className="vo-ios-banner-photo">
              {b.photo || b.name ? <UserPhoto src={b.photo} name={b.name || "?"} size="xs" className="h-full w-full rounded-[10px] text-sm" /> : <LogoMark size={38} />}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="vo-ios-banner-title truncate">{b.title}</span>
              <span className="vo-ios-banner-sub truncate">{b.sub}</span>
            </span>
            <span className="vo-ios-banner-time">now</span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};
