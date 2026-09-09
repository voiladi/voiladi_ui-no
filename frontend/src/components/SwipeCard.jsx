import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from "framer-motion";
import { MapPin, ChevronUp, Quote } from "lucide-react";
import { UserPhoto } from "@/components/UserPhoto";
import { CompatibilityRing } from "@/components/CompatibilityRing";
import { Tag } from "@/components/Chip";
import { ReactHeart } from "@/components/ReactHeart";
import { distanceLabel, activeLabel } from "@/lib/format";
import { EASE, SETTLE } from "@/lib/motion";

const LIKE_X = 100;
const VOILA_Y = -110;
const EXIT = { duration: 0.32, ease: EASE };
const STACK = { duration: 0.22, ease: EASE };

/**
 * Performance notes (swipe used to stutter):
 * - The drag layer is promoted to its own GPU layer (.vo-gpu) and only ever changes transform.
 * - Nothing inside the card uses backdrop-filter (re-blurring every frame was the main cost).
 * - Stack re-ordering uses short tweens, not springs, so cards settle in one pass.
 * - Photos decode async (UserPhoto) and are resized server-side on upload.
 */
export const SwipeCard = forwardRef(({ profile, active, depth = 0, onSwipe, onOpen }, ref) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-9, 0, 9]);
  const likeOp = useTransform(x, [20, LIKE_X], [0, 1]);
  const passOp = useTransform(x, [-20, -LIKE_X], [0, 1]);
  const voilaOp = useTransform(y, [-20, VOILA_Y], [0, 1]);
  const [idx, setIdx] = useState(0);
  const [stamp, setStamp] = useState("Like");
  const exiting = useRef(false);
  const photos = profile.photos?.length ? profile.photos : [null];

  const fly = useCallback(
    (action, reaction = null) => {
      if (exiting.current) return;
      exiting.current = true;
      if (reaction) setStamp(reaction.type === "photo" ? "Liked photo" : "Liked answer");
      const dir = action === "like" ? 1 : action === "pass" ? -1 : 0;
      const tx = dir * 640;
      const ty = action === "superlike" ? -820 : y.get() * 1.4;
      animate(y, ty, EXIT);
      animate(x, tx, { ...EXIT, onComplete: () => onSwipe(profile, action, reaction) });
    },
    [x, y, onSwipe, profile]
  );

  useImperativeHandle(ref, () => ({ swipe: fly }), [fly]);

  const onDragEnd = (_, info) => {
    const { offset, velocity } = info;
    if (offset.x > LIKE_X || velocity.x > 800) return fly("like");
    if (offset.x < -LIKE_X || velocity.x < -800) return fly("pass");
    if ((offset.y < VOILA_Y || velocity.y < -800) && Math.abs(offset.x) < 90) return fly("superlike");
    animate(x, 0, SETTLE);
    animate(y, 0, SETTLE);
    return undefined;
  };

  const tap = (dir) => (e) => {
    e.stopPropagation();
    if (Math.abs(x.get()) > 6 || Math.abs(y.get()) > 6) return;
    setIdx((i) => Math.max(0, Math.min(photos.length - 1, i + dir)));
  };

  const scale = 1 - depth * 0.04;
  const yOff = depth * 12;
  const activeStr = activeLabel(profile.last_active);
  const currentPhoto = photos[idx];
  const prompt = profile.prompts?.[0];

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - depth, pointerEvents: active ? "auto" : "none" }}
      initial={false}
      animate={{ scale, y: yOff, opacity: depth > 1 ? 0.6 : 1 }}
      transition={STACK}
      data-testid={active ? "discover-card-active" : `discover-card-behind-${depth}`}
    >
      <motion.div
        className="vo-gpu absolute inset-0 touch-none"
        style={{ x, y, rotate }}
        drag={active}
        dragElastic={1}
        dragMomentum={false}
        onDragEnd={onDragEnd}
      >
        <div className="absolute inset-0 overflow-hidden rounded-sheet border border-line bg-white shadow-card">
          <AnimatePresence initial={false}>
            <motion.div
              key={currentPhoto || idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="absolute inset-0"
            >
              <UserPhoto src={currentPhoto} name={profile.name} className="h-full w-full text-8xl" />
            </motion.div>
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/30 to-transparent" />

          {/* photo tap zones */}
          <button type="button" aria-label="Previous photo" className="absolute inset-y-0 left-0 w-1/2 cursor-default" onClick={tap(-1)} />
          <button type="button" aria-label="Next photo" className="absolute inset-y-0 right-0 w-1/2 cursor-default" onClick={tap(1)} data-testid={active ? "discover-card-next-photo" : undefined} />

          {photos.length > 1 && (
            <div className="pointer-events-none absolute inset-x-4 top-3 flex gap-1">
              {photos.map((_, i) => (
                <span key={i} className={`h-[3px] flex-1 rounded-full ${i === idx ? "bg-white" : "bg-white/40"}`} />
              ))}
            </div>
          )}

          <div className="pointer-events-none absolute left-4 top-8 flex flex-col items-start gap-2">
            <Tag tone="dark">
              <MapPin className="h-3.5 w-3.5" /> {distanceLabel(profile.distance_km, profile.city)}
            </Tag>
            {activeStr && (
              <Tag tone="dark">
                <span className="h-2 w-2 rounded-full bg-online" /> {activeStr}
              </Tag>
            )}
          </div>
          <div className="pointer-events-none absolute right-4 top-8">
            <CompatibilityRing value={profile.compatibility ?? 0} size={54} dark />
          </div>

          {/* stamps */}
          <motion.div style={{ opacity: likeOp }} className="vo-stamp left-6 top-24 -rotate-6 border-ink bg-white/95 text-ink">
            {stamp}
          </motion.div>
          <motion.div style={{ opacity: passOp }} className="vo-stamp right-6 top-24 rotate-6 border-mute2 bg-white/95 text-mute2">
            Pass
          </motion.div>
          <motion.div style={{ opacity: voilaOp }} className="vo-stamp left-1/2 top-1/3 -translate-x-1/2 border-tint bg-white/95 text-tint">
            Voila
          </motion.div>

          {/* info tray */}
          <div className="absolute inset-x-0 bottom-0 rounded-t-sheet bg-white px-5 pb-5 pt-4">
            {currentPhoto && active && (
              <div className="absolute -top-[26px] right-5">
                <ReactHeart
                  label={`Like this photo of ${profile.name}`}
                  onReact={() => fly("like", { type: "photo", photo: currentPhoto })}
                  testId="discover-react-photo-button"
                />
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-[26px] font-bold leading-none tracking-tight text-ink" data-testid={active ? "discover-card-name" : undefined}>
                  {profile.name}
                  {profile.age ? <span className="ml-2 font-medium text-mute">{profile.age}</span> : null}
                </h2>
                {profile.shared_interests?.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {profile.shared_interests.slice(0, 3).map((s) => (
                      <Tag key={s} tone="tint" className="h-7 px-2.5 text-[12px]">
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
                className="vo-icon-btn shrink-0"
                aria-label="View full profile"
                data-testid={active ? "discover-card-open-profile" : undefined}
              >
                <ChevronUp className="h-5 w-5" />
              </button>
            </div>
            {prompt && (
              <div className="mt-3.5 flex items-center gap-2 rounded-card bg-surface2 py-2.5 pl-4 pr-2.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(profile);
                  }}
                  className="min-w-0 flex-1 text-left"
                  data-testid={active ? "discover-card-prompt" : undefined}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-mute">
                    <Quote className="h-3 w-3" /> {prompt.question}
                  </div>
                  <div className="line-clamp-2 font-display text-[16px] leading-snug text-ink">{prompt.answer}</div>
                </button>
                {active && (
                  <ReactHeart
                    size="sm"
                    label={`Like ${profile.name}'s answer`}
                    onReact={() => fly("like", { type: "prompt", question: prompt.question })}
                    className="shrink-0"
                    testId="discover-react-prompt-button"
                  />
                )}
              </div>
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
