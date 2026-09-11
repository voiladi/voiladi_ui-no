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

const StatusBar = () => (
  <div className="flex items-center justify-between px-6 pt-2 text-[15px] font-semibold text-ink" style={{ height: STATUS_H }}>
    <span>9:41</span>
    <span className="flex items-center gap-1.5">
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {[5, 7, 9, 11].map((h) => (
          <span key={h} className="w-[3px] rounded-[1px] bg-ink" style={{ height: h }} />
        ))}
      </span>
      <Wifi className="h-[15px] w-[15px]" strokeWidth={2.4} />
      <span className="relative ml-0.5 h-[11px] w-[24px] rounded-[3px] border-[1.5px] border-ink" aria-hidden="true">
        <span className="absolute inset-[1.5px] rounded-[1.5px] bg-ink" />
      </span>
    </span>
  </div>
);

export const SCREENS = [
  { key: "explore", src: "/landing/explore.webp", alt: "Voiladi Explore screen", title: "Explore your world", sub: "Discover people, interests, and communities." },
  { key: "chat", src: "/landing/chat.webp", alt: "Voiladi Messages screen", title: "Chat your way", sub: "Text, photos, or video - however you feel like it." },
  { key: "likes", src: "/landing/likes.webp", alt: "Voiladi Likes screen", title: "See who notices you", sub: "Likes and interest, all in one glance." },
  { key: "profile", src: "/landing/profile.webp", alt: "Voiladi Profile screen", title: "Own your profile", sub: "Customize your identity, settings, and presence." },
];

/* Phone frame: soft white body with a thin bezel; the 390x888 screen (status bar + capture) is scaled to fit and clipped. */
export const Phone = ({ screen, width, priority = false }) => {
  const bezel = Math.max(6, Math.round(width * 0.03));
  const innerW = width - bezel * 2;
  const scale = innerW / SCREEN_W;
  const innerH = Math.round(SCREEN_H * scale);
  const outerR = Math.round(width * 0.16);
  return (
    <div className="vo-phone" style={{ width, height: innerH + bezel * 2, padding: bezel, borderRadius: outerR }}>
      <div className="vo-phone-clip" style={{ width: innerW, height: innerH, borderRadius: Math.max(8, outerR - bezel) }}>
        <div className="vo-phone-screen vo-neu-page" style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})` }}>
          <StatusBar />
          <img
            src={screen.src}
            alt={screen.alt}
            width={SCREEN_W}
            height={SHOT_H}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            className="block select-none"
            style={{ width: SCREEN_W, height: SHOT_H }}
            data-testid={`landing-shot-${screen.key}`}
          />
        </div>
      </div>
    </div>
  );
};
