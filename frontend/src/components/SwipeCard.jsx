import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { MoreHorizontal, BadgeCheck, Briefcase, MapPin, UserRound, ShieldAlert, Ban } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { UserPhoto } from "@/components/UserPhoto";
import { distanceLabel } from "@/lib/format";
import { EASE, SETTLE } from "@/lib/motion";

const THRESHOLD = 110;
const EXIT = { duration: 0.3, ease: EASE };

/**
 * The Discover card as photographed: rounded photo card, bottom fade, name + age + verified badge,
 * job line, distance line, interest chips and a "..." menu. Drag left/right to pass/like, tap to see the next photo.
 */
export const SwipeCard = forwardRef(({ profile, onSwipe, onOpen, onReport, onBlock }, ref) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-8, 8]);
  const likeOp = useTransform(x, [30, THRESHOLD], [0, 1]);
  const passOp = useTransform(x, [-30, -THRESHOLD], [0, 1]);
  const [idx, setIdx] = useState(0);
  const exiting = useRef(false);
  const photos = profile.photos?.length ? profile.photos : [null];
  const chips = (profile.interests || []).slice(0, 3);

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
      className="vo-gpu absolute inset-0 overflow-hidden rounded-[24px] bg-surface2 shadow-action"
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="More"
            data-testid="discover-card-menu-button"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-[16px] border-line bg-bg p-1.5 shadow-modal" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem className="rounded-[10px] py-2.5 text-[15px]" onClick={() => onOpen(profile)} data-testid="discover-card-open-profile">
            <UserRound className="mr-2 h-4 w-4" /> View full profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="rounded-[10px] py-2.5 text-[15px]" onClick={() => onReport(profile)} data-testid="discover-report-button">
            <ShieldAlert className="mr-2 h-4 w-4" /> Report
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-[10px] py-2.5 text-[15px] text-red focus:text-red" onClick={() => onBlock(profile)} data-testid="discover-block-button">
            <Ban className="mr-2 h-4 w-4" /> Block
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* drag feedback */}
      <motion.span style={{ opacity: likeOp }} className="pointer-events-none absolute left-5 top-12 rounded-full border-2 border-white px-3 py-1 text-[14px] font-bold uppercase tracking-wide text-white">
        Like
      </motion.span>
      <motion.span style={{ opacity: passOp }} className="pointer-events-none absolute right-5 top-12 rounded-full border-2 border-white px-3 py-1 text-[14px] font-bold uppercase tracking-wide text-white">
        Nope
      </motion.span>

      <div className="pointer-events-none absolute inset-x-5 bottom-5 text-white">
        <div className="flex items-center gap-2">
          <h2 className="text-[32px] font-bold leading-none tracking-[-0.02em]" data-testid="discover-card-name">
            {profile.name}
          </h2>
          {profile.age ? <span className="text-[26px] font-medium leading-none">{profile.age}</span> : null}
          {profile.verified && <BadgeCheck className="ml-0.5 h-7 w-7 text-blue" fill="currentColor" stroke="white" strokeWidth={1.75} data-testid="discover-card-verified" />}
        </div>
        {profile.job && (
          <div className="mt-3 flex items-center gap-2 text-[16px] font-medium">
            <Briefcase className="h-[18px] w-[18px]" strokeWidth={1.75} /> {profile.job}
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-2 text-[16px] font-medium" data-testid="discover-card-distance">
          <MapPin className="h-[18px] w-[18px]" strokeWidth={1.75} /> {distanceLabel(profile.distance_km, profile.city)}
        </div>
        {chips.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span key={c} className="vo-chip-glass">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.article>
  );
});
SwipeCard.displayName = "SwipeCard";
