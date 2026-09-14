import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Play } from "lucide-react";
import { UserPhoto } from "@/components/UserPhoto";
import { Skeleton } from "@/components/Loading";
import { compact } from "@/components/feed/PostCard";

/* 3-up grid of post tiles (profile posts / saved). Tap opens the post full-screen. */
export const PostsGrid = ({ posts, loading, emptyTitle = "No posts yet", emptyText = "", testId = "posts-grid" }) => {
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-[3px]" data-testid={`${testId}-loading`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-[10px]" />
        ))}
      </div>
    );
  }
  if (!posts?.length) {
    return (
      <div className="py-10 text-center" data-testid={`${testId}-empty`}>
        <p className="text-[18px] font-bold text-ink">{emptyTitle}</p>
        {emptyText && <p className="mt-1 text-[14.5px] text-mute">{emptyText}</p>}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-[3px]" data-testid={testId}>
      {posts.map((p) => (
        <button key={p.id} type="button" onClick={() => navigate(`/p/${p.id}`)} className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-surface2 focus-visible:outline-none active:opacity-90" data-testid="post-tile">
          <UserPhoto src={p.image} name={p.caption || ""} size="sm" className="h-full w-full" />
          {p.kind === "video" && (
            <span className="absolute right-1.5 top-1.5 text-white" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }} data-testid="post-tile-video-badge">
              <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />
            </span>
          )}
          {p.kind === "video" && p.status !== "ready" && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[12px] font-semibold text-white">{p.status === "failed" ? "Failed" : "Processing"}</span>
          )}
          <span className="absolute bottom-1.5 left-2 inline-flex items-center gap-1 text-[12px] font-semibold text-white" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
            <Heart className="h-3 w-3" fill="currentColor" /> {compact(p.likes)}
          </span>
        </button>
      ))}
    </div>
  );
};
