import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from "framer-motion";
import { MapPin, ChevronUp, Quote } from "lucide-react";
import { UserPhoto } from "@/components/UserPhoto";
import { CompatibilityRing } from "@/components/CompatibilityRing";
import { Tag } from "@/components/Chip";
import { distanceLabel, activeLabel } from "@/lib/format";

const SPRING = { type: "spring", stiffness: 420, damping: 32, mass: 1 };
const LIKE_X = 110;
const VOILA_Y = -110;

export const SwipeCard = forwardRef(({ profile, active, depth = 0, onSwipe, onOpen }, ref) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-11, 0, 11]);
  const likeOp = useTransform(x, [25, LIKE_X], [0, 1]);
  const passOp = useTransform(x, [-25, -LIKE_X], [0, 1]);
  const voilaOp = useTransform(y, [-25, VOILA_Y], [0, 1]);
  const [idx, setIdx] = useState(0);
  const exiting = useRef(false);
  const photos = profile.photos?.length ? profile.photos : [null];

  const fly = useCallback(
    (action) => {
      if (exiting.current) return;
      exiting.current = true;
      const dir = action === "like" ? 1 : action === "pass" ? -1 : 0;
      const tx = dir * 720;
      const ty = action === "superlike" ? -900 : y.get() * 1.5;
      animate(y, ty, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
      animate(x, tx, { duration: 0.45, ease: [0.22, 1, 0.36, 1], onComplete: () => onSwipe(profile, action) });
    },
    [x, y, onSwipe, profile]
  );

  useImperativeHandle(ref, () => ({ swipe: fly }), [fly]);

  const onDragEnd = (_, info) => {
    const { offset, velocity } = info;
    if (offset.x > LIKE_X || velocity.x > 900) return fly("like");
    if (offset.x < -LIKE_X || velocity.x < -900) return fly("pass");
    if ((offset.y < VOILA_Y || velocity.y < -900) && Math.abs(offset.x) < 90) return fly("superlike");
    animate(x, 0, SPRING);
    animate(y, 0, SPRING);
    return undefined;
  };

  const tap = (dir) => (e) => {
    e.stopPropagation();
    if (Math.abs(x.get()) > 6 || Math.abs(y.get()) > 6) return;
    setIdx((i) => Math.max(0, Math.min(photos.length - 1, i + dir)));
  };

  const scale = 1 - depth * 0.045;
  const yOff = depth * 16;
  const tilt = depth === 0 ? 0 : depth === 1 ? -2.4 : 2.2;
  const activeStr = activeLabel(profile.last_active);

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - depth, pointerEvents: active ? "auto" : "none" }}
      initial={false}
      animate={{ scale, y: yOff, rotate: tilt, opacity: depth > 2 ? 0 : 1 }}
      transition={SPRING}
      data-testid={active ? "discover-card-active" : `discover-card-behind-${depth}`}
    >
      <motion.div
        className="absolute inset-0 touch-none"
        style={{ x, y, rotate }}
        drag={active}
        dragElastic={0.95}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        whileTap={active ? { cursor: "grabbing" } : undefined}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[30px] border border-line bg-white shadow-[var(--vo-shadow)]">
          <AnimatePresence initial={false}>
            <motion.div
              key={photos[idx] || idx}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0"
            >
              <UserPhoto src={photos[idx]} name={profile.name} className="h-full w-full text-8xl" />
            </motion.div>
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/35 to-transparent" />

          {/* photo tap zones */}
          <button type="button" aria-label="Previous photo" className="absolute inset-y-0 left-0 w-1/2 cursor-default" onClick={tap(-1)} />
          <button type="button" aria-label="Next photo" className="absolute inset-y-0 right-0 w-1/2 cursor-default" onClick={tap(1)} data-testid={active ? "discover-card-next-photo" : undefined} />

          {photos.length > 1 && (
            <div className="pointer-events-none absolute inset-x-4 top-3 flex gap-1.5">
              {photos.map((_, i) => (
                <span key={i} className={`h-[3px] flex-1 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/40"}`} />
              ))}
            </div>
          )}

          <div className="pointer-events-none absolute left-4 top-8 flex flex-col items-start gap-2">
            <Tag tone="white">
              <MapPin className="h-3.5 w-3.5" /> {distanceLabel(profile.distance_km, profile.city)}
            </Tag>
            {activeStr && (
              <Tag tone="white">
                <span className="h-2 w-2 rounded-full bg-like" /> {activeStr}
              </Tag>
            )}
          </div>
          <div className="pointer-events-none absolute right-4 top-8">
            <CompatibilityRing value={profile.compatibility ?? 0} size={58} dark />
          </div>

          {/* stamps */}
          <motion.div style={{ opacity: likeOp }} className="vo-stamp left-6 top-24 -rotate-12 border-brand bg-brand-soft/90 text-brand">
            Like
          </motion.div>
          <motion.div style={{ opacity: passOp }} className="vo-stamp right-6 top-24 rotate-12 border-pass bg-pass-soft/90 text-pass">
            Pass
          </motion.div>
          <motion.div style={{ opacity: voilaOp }} className="vo-stamp left-1/2 top-1/3 -translate-x-1/2 -rotate-6 border-voila bg-voila-soft/90 text-voila">
            Voila
          </motion.div>

          {/* info tray */}
          <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-line bg-white px-5 pb-5 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-[28px] font-semibold leading-none tracking-tight text-ink" data-testid={active ? "discover-card-name" : undefined}>
                  {profile.name}
                  {profile.age ? <span className="ml-2 font-medium text-mute">{profile.age}</span> : null}
                </h2>
                {profile.shared_interests?.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {profile.shared_interests.slice(0, 3).map((s) => (
                      <Tag key={s} tone="brand" className="h-7 px-2.5 text-[12px]">
                        {s}
                      </Tag>
                    ))}
                    {profile.shared_interests.length > 3 && (
                      <Tag tone="default" className="h-7 px-2.5 text-[12px]">
                        +{profile.shared_interests.length - 3} shared
                      </Tag>
                    )}
                  </div>
                ) : (
                  profile.interests?.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {profile.interests.slice(0, 3).map((s) => (
                        <Tag key={s} tone="default" className="h-7 px-2.5 text-[12px]">
                          {s}
                        </Tag>
                      ))}
                    </div>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(profile);
                }}
                className="vo-icon-btn h-10 w-10 shrink-0"
                aria-label="View full profile"
                data-testid={active ? "discover-card-open-profile" : undefined}
              >
                <ChevronUp className="h-5 w-5" />
              </button>
            </div>
            {profile.prompts?.[0] && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(profile);
                }}
                className="mt-3.5 w-full rounded-[18px] bg-surface2 px-4 py-3 text-left"
              >
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">
                  <Quote className="h-3 w-3" /> {profile.prompts[0].question}
                </div>
                <div className="line-clamp-2 font-display text-[16px] leading-snug text-ink">{profile.prompts[0].answer}</div>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
SwipeCard.displayName = "SwipeCard";

export const CardStack = ({ profiles, onSwipe, onOpen, topRef }) => {
  const visible = profiles.slice(0, 3);
  return (
    <div className="relative h-full w-full" data-testid="discover-card-stack">
      <AnimatePresence initial={false}>
        {visible
          .map((p, i) => (
            <SwipeCard key={p.id} ref={i === 0 ? topRef : null} profile={p} active={i === 0} depth={i} onSwipe={onSwipe} onOpen={onOpen} />
          ))
          .reverse()}
      </AnimatePresence>
    </div>
  );
};
