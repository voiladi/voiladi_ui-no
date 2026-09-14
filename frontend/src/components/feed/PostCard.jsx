import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleMore, Send, Bookmark, Ellipsis, MapPin, Heart, Volume2, VolumeX } from "lucide-react";
import { photoUrl } from "@/lib/api";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { UserPhoto } from "@/components/UserPhoto";

/*
 * One full-screen post, transcribed from the reference photo:
 *  - the picture fills the whole screen (behind the status bar and the floating tab bar)
 *  - right rail: pink heart + count, comment bubble + count, paper plane + count, bookmark + count, "..."
 *  - bottom-left: avatar, username, black tick, outlined "Follow" pill, pin + place, caption
 *  - while the photo downloads a grey shimmer sits in its place, then the photo fades in
 */

export const compact = (n) => {
  n = Number(n) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 < 100_000 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 < 100 ? 0 : 1)}K`;
  return String(n);
};

/* The heart as photographed: soft pink, filled, with a faint glow. When liked it deepens to hot pink. */
const PinkHeart = ({ liked, className = "" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" style={{ filter: "drop-shadow(0 2px 6px rgba(255, 120, 150, 0.45))" }}>
    <defs>
      <linearGradient id="vo-heart-pink" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFC1CF" />
        <stop offset="1" stopColor="#FF8FA8" />
      </linearGradient>
      <linearGradient id="vo-heart-hot" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FF5C8A" />
        <stop offset="1" stopColor="#FF2D55" />
      </linearGradient>
    </defs>
    <path
      d="M12 21s-6.7-4.35-9.33-8.3C.9 10.05 1.7 6.3 4.9 4.9c2.2-.96 4.6-.2 6.1 1.6l1 1.2 1-1.2c1.5-1.8 3.9-2.56 6.1-1.6 3.2 1.4 4 5.15 2.23 7.8C18.7 16.65 12 21 12 21z"
      fill={liked ? "url(#vo-heart-hot)" : "url(#vo-heart-pink)"}
    />
  </svg>
);

const RailButton = ({ label, count, onClick, children, testId, active }) => (
  <div className="flex flex-col items-center">
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      whileTap={{ scale: 0.82 }}
      transition={{ type: "spring", stiffness: 600, damping: 26 }}
      className="flex h-[46px] w-[46px] items-center justify-center text-white focus-visible:outline-none"
      data-testid={testId}
    >
      {children}
    </motion.button>
    {count !== undefined && (
      <span className="-mt-0.5 text-[15px] font-semibold leading-[18px] tracking-[-0.01em] text-white" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.45)" }} data-testid={`${testId}-count`}>
        {compact(count)}
      </span>
    )}
  </div>
);

const ICON = "h-[30px] w-[30px]";
const ICON_SHADOW = { filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.45))" };

export const PostCard = ({ post, onLike, onComment, onShare, onSave, onMore, onFollow, onOpenAuthor, active = true, playing = true, muted = true, onToggleMute }) => {
  const [ready, setReady] = useState(false);
  const [burst, setBurst] = useState(0);
  const [soundFlash, setSoundFlash] = useState(0);
  const lastTap = useRef(0);
  const tapTimer = useRef(null);
  const videoRef = useRef(null);
  const isVideo = post.kind === "video";
  const processing = isVideo && post.status !== "ready";
  const src = photoUrl(post.image);
  const videoSrc = isVideo ? photoUrl(post.video) : "";

  useEffect(() => setReady(false), [src, videoSrc]);

  // only the post on screen plays; the others pause and rewind so they start fresh when scrolled to
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing && active && !processing) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      v.pause();
      if (!playing) {
        try {
          v.currentTime = 0;
        } catch (e) {
          /* not loaded yet */
        }
      }
    }
  }, [playing, active, processing, videoSrc]);

  const onTap = () => {
    const t = Date.now();
    clearTimeout(tapTimer.current);
    if (t - lastTap.current < 280) {
      lastTap.current = 0;
      if (!post.liked) onLike(post);
      setBurst((b) => b + 1);
    } else {
      lastTap.current = t;
      if (isVideo && onToggleMute) {
        // single tap on a video = sound on / off (waits to make sure it isn't the start of a double tap)
        tapTimer.current = setTimeout(() => {
          onToggleMute();
          setSoundFlash((n) => n + 1);
        }, 290);
      }
    }
  };

  return (
    <article className="vo-post relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-black" data-testid="feed-post" data-post-id={post.id}>
      {/* photo: shimmer until decoded, then a soft fade in */}
      <div className={`absolute inset-0 ${ready ? "" : "vo-post-shimmer"}`} onClick={onTap} role="presentation">
        {isVideo && !processing && videoSrc && (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={src || undefined}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: ready ? 1 : 0, transition: "opacity 420ms ease-out" }}
            muted={muted}
            loop
            playsInline
            preload={active ? "auto" : "metadata"}
            onLoadedData={() => setReady(true)}
            onCanPlay={() => setReady(true)}
            onError={() => setReady(true)}
            data-testid="feed-post-video"
            data-ready={ready ? "true" : "false"}
            data-playing={playing ? "true" : "false"}
          />
        )}
        {isVideo && processing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white" data-testid="feed-post-processing">
            <span className="text-[17px] font-semibold">{post.status === "failed" ? "This video couldn't be processed" : "Getting your video ready..."}</span>
            {post.status !== "failed" && <span className="mt-1 text-[14px] text-white/70">It will show up here in a moment.</span>}
          </div>
        )}
        {!isVideo && src && (
          <img
            src={src}
            alt={post.caption || `Post by ${post.author?.name}`}
            className="h-full w-full object-cover"
            style={{ opacity: ready ? 1 : 0, transition: "opacity 420ms ease-out" }}
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
            loading={active ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            data-testid="feed-post-image"
            data-ready={ready ? "true" : "false"}
          />
        )}
      </div>
      {/* legibility: a whisper of shade at the top for the title, a deeper one at the bottom for the text */}
      <div className="vo-post-shade-top pointer-events-none absolute inset-x-0 top-0 h-[160px]" aria-hidden="true" />
      <div className="vo-post-shade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[46%]" aria-hidden="true" />

      {/* sound on / off flash (videos) */}
      <AnimatePresence>
        {soundFlash > 0 && (
          <motion.div key={`s${soundFlash}`} className="pointer-events-none absolute inset-0 flex items-center justify-center" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 1.05] }} transition={{ duration: 0.8, times: [0, 0.15, 0.7, 1] }} onAnimationComplete={() => setSoundFlash(0)}>
            <span className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-black/55 text-white backdrop-blur" data-testid="feed-sound-flash">
              {muted ? <VolumeX className="h-8 w-8" strokeWidth={2} /> : <Volume2 className="h-8 w-8" strokeWidth={2} />}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* double-tap heart */}
      <AnimatePresence>
        {burst > 0 && (
          <motion.div
            key={burst}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 1.1] }}
            transition={{ duration: 0.9, times: [0, 0.2, 0.7, 1] }}
            onAnimationComplete={() => setBurst(0)}
          >
            <Heart className="h-[110px] w-[110px] text-white" fill="currentColor" style={{ filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.35))" }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* right rail */}
      <div className="absolute right-[10px] flex flex-col items-center gap-[10px]" style={{ bottom: "calc(var(--nav-h) + var(--nav-gap) + var(--safe-bottom) + 58px)" }} data-testid="feed-rail">
        <RailButton label={post.liked ? "Unlike" : "Like"} count={post.likes} onClick={() => onLike(post)} testId="post-like-button" active={post.liked}>
          <motion.span key={post.liked ? "on" : "off"} initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 16 }} className="flex">
            <PinkHeart liked={post.liked} className="h-[34px] w-[34px]" />
          </motion.span>
        </RailButton>
        <RailButton label="Comments" count={post.comments} onClick={() => onComment(post)} testId="post-comment-button">
          <MessageCircleMore className={ICON} strokeWidth={1.9} style={ICON_SHADOW} />
        </RailButton>
        <RailButton label="Share" count={post.shares} onClick={() => onShare(post)} testId="post-share-button">
          <Send className={ICON} strokeWidth={1.9} style={ICON_SHADOW} />
        </RailButton>
        <RailButton label={post.saved ? "Remove from saved" : "Save"} count={post.saves} onClick={() => onSave(post)} testId="post-save-button" active={post.saved}>
          <Bookmark className={ICON} strokeWidth={1.9} fill={post.saved ? "currentColor" : "none"} style={ICON_SHADOW} />
        </RailButton>
        <RailButton label="More" onClick={() => onMore(post)} testId="post-more-button">
          <Ellipsis className="h-[28px] w-[28px]" strokeWidth={2.4} style={ICON_SHADOW} />
        </RailButton>
      </div>

      {/* author + caption */}
      <div className="absolute left-[18px] right-[76px] text-white" style={{ bottom: "calc(var(--nav-h) + var(--nav-gap) + var(--safe-bottom) + 16px)", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }} data-testid="feed-post-info">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onOpenAuthor(post)} className="shrink-0 rounded-full ring-[2px] ring-white/95 focus-visible:outline-none active:opacity-90" aria-label={`Open ${post.author?.name}'s profile`} data-testid="post-author-avatar" data-user-id={post.author?.id}>
            <UserPhoto src={post.author?.photo} name={post.author?.name} size="xs" className="h-[34px] w-[34px] rounded-full text-[14px]" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => onOpenAuthor(post)} className="truncate text-[20px] font-bold leading-[24px] tracking-[-0.01em] focus-visible:outline-none active:opacity-80" data-testid="post-author-username">
              {post.author?.username || post.author?.name}
            </button>
            {post.author?.verified && <VerifiedBadge size={18} onPhoto className="!bg-white !text-black !ring-0" testId="post-author-verified" />}
            {!post.mine && (
              <button
                type="button"
                onClick={() => !post.followed && onFollow(post)}
                aria-pressed={post.followed}
                className={`ml-1 inline-flex h-[26px] shrink-0 items-center rounded-full border-[1.5px] border-white px-[13px] text-[14px] font-semibold leading-none tracking-[-0.01em] focus-visible:outline-none active:opacity-80 ${post.followed ? "bg-white/25" : "bg-transparent"}`}
                style={{ textShadow: "none", transitionProperty: "background-color, opacity", transitionDuration: "160ms" }}
                data-testid="post-follow-button"
              >
                {post.followed ? "Following" : "Follow"}
              </button>
            )}
          </div>
        </div>
        {post.location && (
          <div className="mt-[5px] flex items-center gap-1.5 pl-0.5 text-[15px] leading-[18px] tracking-[-0.005em]" data-testid="post-location">
            <MapPin className="h-[16px] w-[16px]" strokeWidth={2.2} fill="currentColor" style={{ color: "#fff" }} />
            <span className="truncate">{post.location}</span>
          </div>
        )}
        {post.caption && (
          <p className="mt-[5px] line-clamp-3 text-[18px] leading-[22px] tracking-[-0.01em]" data-testid="post-caption">
            {post.caption}
          </p>
        )}
      </div>
    </article>
  );
};
