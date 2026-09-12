import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
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

/* One post full-screen (opened from a shared message, a copied link, a profile tile or Saved). */
export default function PostView() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { meta } = useMeta();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState("");
  const [deleteFor, setDeleteFor] = useState(null);
  const A = usePostActions(setPosts);

  useEffect(() => {
    setPosts(null);
    setError("");
    api
      .get(`/posts/${postId}`)
      .then(({ data }) => setPosts([data]))
      .catch((e) => {
        setError(errMsg(e, "This post isn't available"));
        setPosts([]);
      });
  }, [postId]);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/discover"));
  const post = posts?.[0];

  return (
    <div className="vo-feed absolute inset-0 overflow-hidden bg-black" style={{ "--nav-h": "0px", "--nav-gap": "18px" }} data-testid="post-view-page">
      {post && (
        <div className="h-full w-full">
          <PostCard post={post} onLike={A.like} onSave={A.save} onFollow={A.follow} onComment={A.setCommentsFor} onShare={A.setShareFor} onMore={A.setMoreFor} onOpenAuthor={A.openAuthor} />
        </div>
      )}
      <button type="button" onClick={back} aria-label="Back" className="absolute left-[10px] flex h-11 w-11 items-center justify-center text-white focus-visible:outline-none active:opacity-70" style={{ top: "calc(env(safe-area-inset-top, 0px) + 46px)", filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.5))" }} data-testid="post-view-back-button">
        <ChevronLeft className="h-8 w-8" strokeWidth={2.4} />
      </button>
      {posts === null && (
        <div className="absolute inset-0 flex items-center justify-center" data-testid="post-view-loading" aria-busy="true">
          <Spinner size={30} stroke={2.5} className="text-white" />
        </div>
      )}
      {posts && !post && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white" data-testid="post-view-missing">
          <p className="text-[20px] font-bold">{error || "This post was removed"}</p>
          <button type="button" onClick={() => navigate("/discover")} className="mt-6 h-[46px] rounded-full bg-white px-7 text-[16px] font-semibold text-black active:opacity-80" data-testid="post-view-go-discover">
            Back to Discover
          </button>
        </div>
      )}

      <CommentsSheet post={A.commentsFor} open={!!A.commentsFor} onOpenChange={(o) => !o && A.setCommentsFor(null)} onCount={A.setComments} />
      <ShareSheet post={A.shareFor} open={!!A.shareFor} onOpenChange={(o) => !o && A.setShareFor(null)} onShared={A.setShares} />
      <MoreSheet post={A.moreFor} open={!!A.moreFor} onOpenChange={(o) => !o && A.setMoreFor(null)} onNotInterested={async (p) => { await A.notInterested(p); back(); }} onReport={(p) => A.setReportFor(p)} onDelete={(p) => setDeleteFor(p)} />
      <ReportDialog open={!!A.reportFor} onOpenChange={(o) => { if (!o) { A.setReportFor(null); if (!posts?.length) back(); } }} reasons={meta.report_reasons} onSubmit={A.report} name="this post" />
      <ConfirmDialog open={!!deleteFor} onOpenChange={(o) => !o && setDeleteFor(null)} title="Delete this post?" description="It will be removed for everyone. This can't be undone." confirmText="Delete" danger onConfirm={async () => { if (await A.remove(deleteFor)) { setDeleteFor(null); navigate("/profile", { replace: true }); } }} testId="post-delete-dialog" />
      <ProfileSheet profile={A.author} open={!!A.author} onOpenChange={(o) => !o && A.setAuthor(null)} isSelf={A.author?.id === user?.id} />
      <MatchModal match={A.match} me={user} onClose={() => A.setMatch(null)} onSayHi={() => navigate(`/chats/${A.match.id}`)} />
    </div>
  );
}
