import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { MapPin } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { UserPhoto } from "@/components/UserPhoto";
import { distanceLabel } from "@/lib/format";
import { EASE, SETTLE } from "@/lib/motion";

const THRESHOLD = 110;
const EXIT = { duration: 0.3, ease: EASE };

/**
 * The Discover card as photographed: rounded photo card, "1/6" photo counter, bottom fade, "Maya, 24", what they do,
 * and the distance line. Drag left/right to pass/like, tap the photo to see the next one, tap the caption to open
 * the full profile (report / block live there).
 */
export const SwipeCard = forwardRef(({ profile, onSwipe, onOpen }, ref) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-8, 8]);
  const likeOp = useTransform(x, [30, THRESHOLD], [0, 1]);
  const passOp = useTransform(x, [-30, -THRESHOLD], [0, 1]);
  const [idx, setIdx] = useState(0);
  const exiting = useRef(false);
  const photos = profile.photos?.length ? profile.photos : [null];

  const fly = useCallback(
    (action, reaction = null) => {
      if (exiting.current) return;
      exiting.current = true;
      if (action === "superlike") {
        animate(y, -800, { ...EXIT, onComplete: () => onSwipe(profile, action, reaction) });
      } else {
        animate(x, (action === "like" ? 1 : -1) * 640, { ...EXIT, onComplete: () => onSwipe(profile, action, reaction) });
      }
    },
    [x, y, onSwipe, profile]
  );

  useImperativeHandle(ref, () => ({ swipe: fly }), [fly]);

  const onDragEnd = (_, info) => {
    const { offset, velocity } = info;
    if (offset.x > THRESHOLD || velocity.x > 700) return fly("like");
    if (offset.x < -THRESHOLD || velocity.x < -700) return fly("pass");
    animate(x, 0, SETTLE);
    return undefined;
  };

  const onTap = (e) => {
    if (Math.abs(x.get()) > 6 || photos.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const left = e.clientX - rect.left < rect.width / 2;
    setIdx((i) => (left ? (i - 1 + photos.length) % photos.length : (i + 1) % photos.length));
  };

  return (
    <motion.article
      className="vo-gpu absolute inset-0 overflow-hidden rounded-[26px] bg-surface2"
      style={{ x, y, rotate }}
      drag="x"
      dragElastic={0.9}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      onClick={onTap}
      data-testid="discover-card-active"
    >
      <UserPhoto src={photos[idx]} name={profile.name} className="h-full w-full text-8xl" data-testid="discover-card-photo" />
      <div className="vo-photo-fade pointer-events-none absolute inset-x-0 bottom-0 h-[55%]" />

      <span className="absolute right-4 top-4 rounded-full bg-black/35 px-3 py-1.5 text-[14px] font-semibold tabular-nums text-white backdrop-blur-md" data-testid="discover-card-counter">
        {idx + 1}/{photos.length}
      </span>

      {/* drag feedback */}
      <motion.span style={{ opacity: likeOp }} className="pointer-events-none absolute left-5 top-12 rounded-full border-2 border-white px-3 py-1 text-[14px] font-bold uppercase tracking-wide text-white">
        Like
      </motion.span>
      <motion.span style={{ opacity: passOp }} className="pointer-events-none absolute right-5 top-12 rounded-full border-2 border-white px-3 py-1 text-[14px] font-bold uppercase tracking-wide text-white">
        Nope
      </motion.span>

      <button
        type="button"
        className="absolute inset-x-5 bottom-5 text-left text-white focus-visible:outline-none"
        onClick={(e) => {
          e.stopPropagation();
          if (Math.abs(x.get()) < 6) onOpen(profile);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Open ${profile.name}'s profile`}
        data-testid="discover-card-open-profile"
      >
        <span className="flex items-center gap-2">
          <h2 className="text-[clamp(23px,7cqi,28px)] font-bold leading-[1.15] tracking-[-0.02em]" data-testid="discover-card-name">
            {profile.name}
            {profile.age ? `, ${profile.age}` : ""}
          </h2>
          {profile.verified && <VerifiedBadge size={24} onPhoto testId="discover-card-verified" />}
        </span>
        {profile.job && <span className="mt-1 block text-[17px] leading-[22px] tracking-[-0.01em] text-white/95">{profile.job}</span>}
        <span className="mt-1.5 flex items-center gap-1.5 text-[15px] leading-[20px] text-white/95" data-testid="discover-card-distance">
          <MapPin className="h-4 w-4" strokeWidth={2} /> {distanceLabel(profile.distance_km, profile.city)}
        </span>
      </button>
    </motion.article>
  );
});
SwipeCard.displayName = "SwipeCard";
