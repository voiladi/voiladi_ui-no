import React from "react";
import { Wifi } from "lucide-react";

/*
 * Phone carousel content for the landing page: REAL captures of the live app (Explore / Messages / Likes / Profile),
 * taken at 390x844 @2x and stored in /public/landing/*.webp. Re-capture after UI changes so the site always shows the
 * app exactly as it is. The iOS status bar is drawn by the frame so the capture is only the app itself.
 */

export const SCREEN_W = 390;
export const STATUS_H = 44;
export const SHOT_H = 844;
export const SCREEN_H = STATUS_H + SHOT_H;

/* iOS-style status bar drawn by the frame; every size is in container-inline units so it scales with the phone width. */
const StatusBar = () => (
  <div className="flex items-center justify-between font-semibold text-ink" style={{ height: "11.3cqi", padding: "1.5cqi 6cqi 0", fontSize: "3.9cqi" }}>
    <span>9:41</span>
    <span className="flex items-center" style={{ gap: "1.4cqi" }}>
      <span className="flex items-end" style={{ gap: "0.5cqi" }} aria-hidden="true">
        {[1.3, 1.8, 2.3, 2.8].map((h) => (
          <span key={h} className="rounded-[1px] bg-ink" style={{ width: "0.8cqi", height: `${h}cqi` }} />
        ))}
      </span>
      <Wifi style={{ width: "3.9cqi", height: "3.9cqi" }} strokeWidth={2.4} />
      <span className="relative rounded-[2px] border-ink" style={{ width: "6.2cqi", height: "2.9cqi", borderWidth: "0.4cqi", marginLeft: "0.4cqi" }} aria-hidden="true">
        <span className="absolute rounded-[1px] bg-ink" style={{ inset: "0.35cqi" }} />
      </span>
    </span>
  </div>
);

export const SCREENS = [
  { key: "explore", src: "/landing/explore-v2.webp", alt: "Voiladi Explore screen", title: "Explore your world", sub: "Discover people, interests, and communities." },
  { key: "chat", src: "/landing/chat-v2.webp", alt: "Voiladi Messages screen", title: "Chat your way", sub: "Text, photos, or video - however you feel like it." },
  { key: "likes", src: "/landing/likes-v2.webp", alt: "Voiladi Likes screen", title: "See who notices you", sub: "Likes and interest, all in one glance." },
  { key: "profile", src: "/landing/profile-v2.webp", alt: "Voiladi Profile screen", title: "Own your profile", sub: "Customize your identity, settings, and presence." },
];

/*
 * Phone frame: soft white body with a thin bezel. Fully fluid - the parent (.vo-phone-slot) is a size container and
 * everything inside is sized in cqi, so the frame can be animated by width with no transform: scale() (crisp corners).
 */
export const Phone = ({ screen, priority = false }) => (
  <div className="vo-phone">
    <div className="vo-phone-clip">
      <div className="vo-phone-screen vo-neu-page">
        <StatusBar />
        <img
          src={screen.src}
          alt={screen.alt}
          width={SCREEN_W}
          height={SHOT_H}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          className="block w-full select-none"
          style={{ aspectRatio: `${SCREEN_W} / ${SHOT_H}`, height: "auto" }}
          data-testid={`landing-shot-${screen.key}`}
        />
      </div>
    </div>
  </div>
);
