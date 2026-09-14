import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, RefreshCw, Users } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { usePostActions } from "@/hooks/usePostActions";
import { Spinner } from "@/components/Loading";
import { PostCard } from "@/components/feed/PostCard";
import { CommentsSheet, ShareSheet, MoreSheet } from "@/components/feed/PostSheets";
import { ProfileSheet } from "@/components/ProfileSheet";
import { MatchModal } from "@/components/MatchModal";
import { ReportDialog, ConfirmDialog } from "@/components/Dialogs";

/*
 * Discover = the feed. Full-screen posts, one per screen, snap scrolling upwards (reference photo).
 * Opening the tab: black canvas + Instagram spinner while the first page arrives; every post then shows a grey
 * shimmer in place of its photo until the photo has decoded, and fades it in.
 */
export default function Discover() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { meta } = useMeta();
  const [posts, setPosts] = useState(null); // null = first load
  const [error, setError] = useState("");
  const [next, setNext] = useState(null);
  const [active, setActive] = useState(0);
  const [deleteFor, setDeleteFor] = useState(null);
  const [muted, setMuted] = useState(true); // one sound setting for the whole feed (Instagram behaviour)
  const [scope, setScope] = useState(() => (sessionStorage.getItem("vo_feed_scope") === "circle" ? "circle" : "all")); // all = Discover, circle = people you follow
  const scroller = useRef(null);
  const loadingMore = useRef(false);
  const A = usePostActions(setPosts);

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/posts/feed", { params: { limit: 8, scope } });
      setPosts(data.posts);
      setNext(data.next);
      setActive(0);
      if (scroller.current) scroller.current.scrollTop = 0;
    } catch (e) {
      setError(errMsg(e, "Couldn't load posts right now."));
      setPosts((p) => p || []);
    }
  }, [scope]);

  const switchScope = (next) => {
    if (next === scope) return;
    sessionStorage.setItem("vo_feed_scope", next);
    setPosts(null);
    setScope(next);
  };

  const loadMore = useCallback(async () => {
    if (!next || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const { data } = await api.get("/posts/feed", { params: { limit: 8, before: next, scope } });
      setPosts((p) => {
        const seen = new Set((p || []).map((x) => x.id));
        return [...(p || []), ...data.posts.filter((x) => !seen.has(x.id))];
      });
      setNext(data.next);
    } catch (e) {
      /* keep what we have; the user can scroll again */
    } finally {
      loadingMore.current = false;
    }
  }, [next, scope]);

  useEffect(() => {
    load();
  }, [load]);

  // which post is on screen (for eager image loading + paging)
  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
        setActive(i);
        if (posts && i >= posts.length - 3) loadMore();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [posts, loadMore]);

  const first = posts === null;
  const empty = !first && posts.length === 0 && !error;

  return (
    <div className="vo-feed absolute inset-0 overflow-hidden bg-black" data-testid="discover-page">
      {/* the posts scroll under the title */}
      <div ref={scroller} className="vo-feed-scroller h-full w-full snap-y snap-mandatory overflow-y-auto" data-testid="feed-scroller">
        {!first && !error && posts.map((p, i) => (
          <PostCard
            key={p.id}
            post={p}
            active={Math.abs(i - active) <= 1}
            playing={i === active && !A.commentsFor && !A.shareFor && !A.moreFor && !A.author}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onLike={A.like}
            onSave={A.save}
            onFollow={A.follow}
            onComment={A.setCommentsFor}
            onShare={A.setShareFor}
            onMore={A.setMoreFor}
            onOpenAuthor={A.openAuthor}
          />
        ))}
      </div>

      {/* Discover (everyone) | Circle (people you follow) - minimal text tabs, Instagram-style */}
      <div className="absolute left-[20px] flex items-end gap-[16px] text-white" style={{ top: "12px", textShadow: "0 1px 8px rgba(0,0,0,0.45)" }} data-testid="discover-scope-tabs" role="tablist">
        {[
          { value: "all", label: "Discover" },
          { value: "circle", label: "Circle" },
        ].map((t) => {
          const on = scope === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => switchScope(t.value)}
              className={`relative pb-[5px] font-semibold leading-[28px] tracking-[-0.02em] focus-visible:outline-none active:opacity-80 ${on ? "text-[23px] text-white" : "text-[20px] text-white/60"}`}
              style={{ transitionProperty: "color, opacity", transitionDuration: "160ms" }}
              data-testid={`discover-tab-${t.value}`}
            >
              {on ? <h1 className="inline" data-testid="discover-title">{t.label}</h1> : t.label}
              {on && <span className="absolute bottom-0 left-0 h-[2px] w-[22px] rounded-full bg-white" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {/* first load: Instagram spinner on black */}
      {first && (
        <div className="absolute inset-0 flex items-center justify-center" data-testid="feed-loading" aria-busy="true">
          <Spinner size={30} stroke={2.5} className="text-white" />
        </div>
      )}

      {!first && error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white" data-testid="error-alert">
          <RefreshCw className="h-8 w-8" strokeWidth={1.8} />
          <p className="mt-4 text-[20px] font-bold">Couldn't load posts</p>
          <p className="mt-1 text-[15px] text-white/70">{error}</p>
          <button type="button" onClick={() => { setPosts(null); load(); }} className="mt-6 h-[46px] rounded-full bg-white px-7 text-[16px] font-semibold text-black active:opacity-80" data-testid="discover-retry-button">
            Try again
          </button>
        </div>
      )}

      {empty && scope === "circle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white" data-testid="circle-empty-state">
          <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/10">
            <Users className="h-7 w-7" strokeWidth={1.8} />
          </span>
          <p className="mt-5 text-[22px] font-bold">Your circle is quiet</p>
          <p className="mt-1.5 max-w-[280px] text-[16px] leading-[22px] text-white/70">Posts from people you follow show up here. Follow a few people to fill it.</p>
          <button type="button" onClick={() => navigate("/explore")} className="mt-6 h-[50px] rounded-full bg-white px-7 text-[16px] font-semibold text-black active:opacity-80" data-testid="circle-find-people-button">
            Find people
          </button>
          <button type="button" onClick={() => switchScope("all")} className="mt-4 text-[16px] font-medium text-white/70 active:opacity-60" data-testid="circle-back-to-discover">
            Back to Discover
          </button>
        </div>
      )}

      {empty && scope !== "circle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white" data-testid="empty-state">
          <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/10">
            <ImagePlus className="h-7 w-7" strokeWidth={1.8} />
          </span>
          <p className="mt-5 text-[22px] font-bold">Nothing here yet</p>
          <p className="mt-1.5 max-w-[280px] text-[16px] leading-[22px] text-white/70">Be the first. Share a photo of your day.</p>
          <button type="button" onClick={() => navigate("/posts/new")} className="mt-6 h-[50px] rounded-full bg-white px-7 text-[16px] font-semibold text-black active:opacity-80" data-testid="discover-create-post-button">
            Create a post
          </button>
          <button type="button" onClick={() => { setPosts(null); load(); }} className="mt-4 text-[16px] font-medium text-white/70 active:opacity-60" data-testid="discover-refresh-button">
            Refresh
          </button>
        </div>
      )}

      <CommentsSheet post={A.commentsFor} open={!!A.commentsFor} onOpenChange={(o) => !o && A.setCommentsFor(null)} onCount={A.setComments} />
      <ShareSheet post={A.shareFor} open={!!A.shareFor} onOpenChange={(o) => !o && A.setShareFor(null)} onShared={A.setShares} />
      <MoreSheet
        post={A.moreFor}
        open={!!A.moreFor}
        onOpenChange={(o) => !o && A.setMoreFor(null)}
        onNotInterested={A.notInterested}
        onReport={(p) => A.setReportFor(p)}
        onDelete={(p) => setDeleteFor(p)}
      />
      <ReportDialog open={!!A.reportFor} onOpenChange={(o) => !o && A.setReportFor(null)} reasons={meta.report_reasons} onSubmit={A.report} name={A.reportFor ? `this post` : ""} />
      <ConfirmDialog open={!!deleteFor} onOpenChange={(o) => !o && setDeleteFor(null)} title="Delete this post?" description="It will be removed for everyone. This can't be undone." confirmText="Delete" danger onConfirm={async () => { if (await A.remove(deleteFor)) setDeleteFor(null); }} testId="post-delete-dialog" />
      <ProfileSheet profile={A.author} open={!!A.author} onOpenChange={(o) => !o && A.setAuthor(null)} isSelf={A.author?.id === user?.id} />
      <MatchModal match={A.match} me={user} onClose={() => A.setMatch(null)} onSayHi={() => navigate(`/chats/${A.match.id}`)} />
    </div>
  );
}
