import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, X, Zap, Quote } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { useLikesQuery } from "@/hooks/useBadges";
import { UserPhoto } from "@/components/UserPhoto";
import { PageHeader, EmptyState, Skeleton } from "@/components/EmptyState";
import { ProfileSheet } from "@/components/ProfileSheet";
import { MatchModal } from "@/components/MatchModal";
import { ConfirmDialog, ReportDialog } from "@/components/Dialogs";
import { ReactionPill, reactionLabel } from "@/components/ReactHeart";
import { Tag } from "@/components/Chip";
import { tween } from "@/lib/motion";

const ReactionNote = ({ like, me }) => {
  const r = like?.reaction;
  if (!r) return null;
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface2 p-3" data-testid="likes-reaction-note">
      {r.type === "photo" ? (
        <UserPhoto src={r.photo} name={me?.name} className="h-14 w-12 shrink-0 rounded-[10px] text-base" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-white text-ink">
          <Quote className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-ink">{reactionLabel(r, { name: like.user.name })}</div>
        {r.type === "prompt" && <div className="truncate text-[13px] text-mute">"{r.answer}"</div>}
      </div>
    </div>
  );
};

export default function Likes() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { meta } = useMeta();
  const { data, isLoading, isError, refetch } = useLikesQuery();
  const [sheet, setSheet] = useState(null); // like entry {user, reaction, superlike}
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [acting, setActing] = useState(false);
  const likes = data?.likes || [];

  const removeFromList = (id) =>
    qc.setQueryData(["likes"], (old) => (old ? { ...old, likes: old.likes.filter((l) => l.user.id !== id), count: Math.max(0, old.count - 1) } : old));

  const respond = async (profile, action, reaction = null) => {
    setBusy(profile.id);
    try {
      const { data: res } = await api.post("/swipe", { target_id: profile.id, action, reaction: reaction || undefined });
      removeFromList(profile.id);
      setSheet(null);
      if (res.matched) {
        setMatch(res.match);
        qc.invalidateQueries({ queryKey: ["matches"] });
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const doBlock = async () => {
    if (!blockTarget) return;
    setActing(true);
    try {
      await api.post(`/users/${blockTarget.id}/block`);
      removeFromList(blockTarget.id);
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast(`${blockTarget.name} is blocked`);
      setBlockTarget(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setActing(false);
    }
  };

  const doReport = async (reason, details) => {
    if (!reportTarget) return;
    setActing(true);
    try {
      await api.post(`/users/${reportTarget.id}/report`, { reason, details });
      toast("Report received. Thank you.");
      setReportTarget(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setActing(false);
    }
  };

  const sheetProfile = sheet?.user || null;

  return (
    <div className="min-h-full pb-24" data-testid="likes-page">
      <PageHeader title="Likes" subtitle={likes.length ? `${likes.length} ${likes.length === 1 ? "person likes" : "people like"} you. No pressure.` : "People who liked you show up here."} />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-4 pt-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={Heart}
          title="Couldn't load likes"
          description="Check your connection and try again."
          testId="error-alert"
          action={
            <button type="button" className="vo-btn-primary" onClick={() => refetch()}>
              Try again
            </button>
          }
        />
      ) : likes.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No likes yet"
          description="Keep swiping. When someone likes you, they'll show up here and you can like them back."
          action={
            <button type="button" className="vo-btn-primary" onClick={() => navigate("/discover")} data-testid="likes-go-discover-button">
              Go to Discover
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pt-2" data-testid="likes-grid">
          {likes.map((l, idx) => {
            const p = l.user;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={tween(0.25, Math.min(idx, 6) * 0.03)}
                className="relative overflow-hidden rounded-card border border-line bg-white"
                data-testid="likes-grid-tile"
              >
                <button type="button" className="block w-full text-left" onClick={() => setSheet(l)} data-testid="likes-tile-open">
                  <div className="relative aspect-[3/4]">
                    <UserPhoto src={p.photos?.[0]} name={p.name} className="h-full w-full text-5xl" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 to-transparent" />
                    <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
                      {l.superlike && (
                        <Tag tone="white" className="h-7 px-2.5 text-[12px] text-tint">
                          <Zap className="h-3.5 w-3.5 fill-tint" /> Voila'd you
                        </Tag>
                      )}
                      {l.reaction && (
                        <ReactionPill className="bg-white/95" testId="likes-reaction-tag">
                          {l.reaction.type === "photo" ? "Liked your photo" : "Liked your answer"}
                        </ReactionPill>
                      )}
                    </div>
                    <div className="absolute inset-x-3 bottom-3 text-white">
                      <div className="font-display text-[19px] font-semibold leading-tight">
                        {p.name}
                        {p.age ? <span className="ml-1.5 font-medium opacity-80">{p.age}</span> : null}
                      </div>
                      <div className="text-[12px] opacity-90">{p.compatibility}% match</div>
                    </div>
                  </div>
                </button>
                <div className="flex gap-2 p-2.5">
                  <button type="button" className="vo-icon-btn h-10 flex-1 rounded-[10px] text-mute" onClick={() => respond(p, "pass")} disabled={busy === p.id} aria-label="Pass" data-testid="likes-pass-button">
                    <X className="h-5 w-5" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className="flex h-10 flex-[1.6] items-center justify-center gap-1.5 rounded-[10px] bg-ink text-[13px] font-semibold text-white transition-colors duration-150 ease-ios hover:bg-ink2 active:opacity-80 disabled:opacity-50"
                    onClick={() => respond(p, "like")}
                    disabled={busy === p.id}
                    data-testid="likes-like-back-button"
                  >
                    <Heart className="h-4 w-4 fill-white" /> Like back
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <ProfileSheet
        profile={sheetProfile}
        open={!!sheetProfile}
        onOpenChange={(o) => !o && setSheet(null)}
        note={<ReactionNote like={sheet} me={user} />}
        onReact={(reaction) => sheetProfile && respond(sheetProfile, "like", reaction)}
        onBlock={() => {
          setBlockTarget(sheetProfile);
          setSheet(null);
        }}
        onReport={() => {
          setReportTarget(sheetProfile);
          setSheet(null);
        }}
        actions={
          sheetProfile && (
            <div className="flex gap-3">
              <button type="button" className="vo-btn-outline flex-1 text-mute" onClick={() => respond(sheetProfile, "pass")} disabled={busy === sheetProfile.id} data-testid="sheet-pass-button">
                <X className="h-5 w-5" /> Pass
              </button>
              <button type="button" className="vo-btn-primary flex-[1.4]" onClick={() => respond(sheetProfile, "like")} disabled={busy === sheetProfile.id} data-testid="sheet-like-button">
                <Heart className="h-5 w-5 fill-white" /> Like back
              </button>
            </div>
          )
        }
      />
      <MatchModal match={match} me={user} onClose={() => setMatch(null)} onSayHi={() => navigate(`/chats/${match.id}`)} />
      <ConfirmDialog
        open={!!blockTarget}
        onOpenChange={(o) => !o && setBlockTarget(null)}
        title={`Block ${blockTarget?.name}?`}
        description="They won't be able to see your profile or message you, and you won't see them again. They won't be notified."
        confirmText="Block"
        danger
        loading={acting}
        onConfirm={doBlock}
        testId="block-dialog"
      />
      <ReportDialog open={!!reportTarget} onOpenChange={(o) => !o && setReportTarget(null)} reasons={meta.report_reasons} onSubmit={doReport} loading={acting} name={reportTarget?.name} />
    </div>
  );
}
