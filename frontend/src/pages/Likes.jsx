import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, X, ChevronRight, MoreHorizontal, UserRound, ShieldAlert, Ban, MessageCircle, Star, Copy, ArrowDownWideNarrow, ArrowUpNarrowWide, Check } from "lucide-react";
import { notice } from "@/lib/feedback";
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { useLikesQuery, useLikesSentQuery } from "@/hooks/useBadges";
import { UserPhoto } from "@/components/UserPhoto";
import { GlassSegmented } from "@/components/GlassSegmented";
import { SkeletonList, Skeleton } from "@/components/EmptyState";
import { SoftIconButton, SoftTitle, SoftEmpty, CardsArt } from "@/components/SoftUI";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ProfileSheet } from "@/components/ProfileSheet";
import { MatchModal } from "@/components/MatchModal";
import { ConfirmDialog, ReportDialog } from "@/components/Dialogs";
import { agoLabel } from "@/lib/format";
import { tween, D } from "@/lib/motion";

const TABS = [
  { value: "all", label: "All" },
  { value: "received", label: "Likes you" },
  { value: "sent", label: "You liked" },
];

const NAV_PAD = "calc(var(--nav-h) + var(--nav-gap) + 14px + var(--safe-bottom))";

export default function Likes() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { meta } = useMeta();
  const received = useLikesQuery();
  const sent = useLikesSentQuery();
  const [tab, setTab] = useState("all");
  const [sort, setSort] = useState("newest");
  const [superOnly, setSuperOnly] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [acting, setActing] = useState(false);

  const rows = useMemo(() => {
    const r = received.data?.likes || [];
    const s = (sent.data?.likes || []).filter((l) => !l.match_id);
    let list = tab === "received" ? r : tab === "sent" ? s : [...r, ...s];
    if (superOnly) list = list.filter((l) => l.superlike);
    return list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1) * (sort === "newest" ? 1 : -1));
  }, [received.data, sent.data, tab, sort, superOnly]);

  const loading = received.isLoading || sent.isLoading;
  const total = (received.data?.count || 0) + (sent.data?.likes || []).filter((l) => !l.match_id).length;

  const dropReceived = (id) => qc.setQueryData(["likes"], (old) => (old ? { ...old, likes: old.likes.filter((l) => l.user.id !== id), count: Math.max(0, old.count - 1) } : old));
  const dropSent = (id) => qc.setQueryData(["likes-sent"], (old) => (old ? { ...old, likes: old.likes.filter((l) => l.user.id !== id), count: Math.max(0, old.count - 1) } : old));

  const respond = async (profile, action, reaction = null) => {
    setBusy(profile.id);
    try {
      const { data: res } = await api.post("/swipe", { target_id: profile.id, action, reaction: reaction || undefined });
      dropReceived(profile.id);
      setSheet(null);
      qc.invalidateQueries({ queryKey: ["likes-sent"] });
      if (res.matched) {
        setMatch(res.match);
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
      }
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const doBlock = async () => {
    if (!blockTarget) return;
    setActing(true);
    try {
      await api.post(`/users/${blockTarget.id}/block`);
      dropReceived(blockTarget.id);
      dropSent(blockTarget.id);
      qc.invalidateQueries({ queryKey: ["matches"] });
      setBlockTarget(null);
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setActing(false);
    }
  };

  const doReport = async (reason, details) => {
    if (!reportTarget) return;
    setActing(true);
    try {
      await api.post(`/users/${reportTarget.id}/report`, { reason, details });
      return true;
    } catch (e) {
      notice(errMsg(e));
      return false;
    } finally {
      setActing(false);
    }
  };

  const sheetProfile = sheet?.user || null;
  const isReceived = sheet?.direction === "received";

  return (
    <div className={`vo-neu-page flex flex-col ${rows.length ? "min-h-full" : "h-full"}`} style={{ paddingBottom: NAV_PAD }} data-testid="likes-page">
      <header className="shrink-0 px-[clamp(14px,5cqi,20px)] pt-3">
        <SoftTitle
          title="Likes"
          subtitle="People who liked you"
          testId="likes-title"
          actions={
            <>
              <span className="vo-soft inline-flex h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-[20px] font-semibold tabular-nums tracking-[-0.02em] text-ink" data-testid="likes-count">
                <Heart className="h-[20px] w-[20px] text-mute" fill="currentColor" strokeWidth={0} />
                {loading ? <Skeleton className="h-4 w-5 rounded-full" /> : total}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SoftIconButton icon={MoreHorizontal} label="More options" testId="likes-more-button" active={superOnly || sort !== "newest"} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-[18px] border-0 bg-bg p-1.5 shadow-modal" data-testid="likes-more-menu">
                  <DropdownMenuItem className="rounded-[12px] py-2.5 text-[15px]" onClick={() => setSort("newest")} data-testid="likes-sort-newest">
                    <ArrowDownWideNarrow className="mr-2 h-4 w-4" /> Newest first
                    {sort === "newest" && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-[12px] py-2.5 text-[15px]" onClick={() => setSort("oldest")} data-testid="likes-sort-oldest">
                    <ArrowUpNarrowWide className="mr-2 h-4 w-4" /> Oldest first
                    {sort === "oldest" && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="rounded-[12px] py-2.5 text-[15px]" onClick={() => setSuperOnly((v) => !v)} data-testid="likes-filter-super">
                    <Star className="mr-2 h-4 w-4" /> Super Likes only
                    {superOnly && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
        <GlassSegmented options={TABS} value={tab} onChange={setTab} testIdPrefix="likes-tab" className="vo-seg-inbox mt-5 mb-1" />
      </header>

      {loading ? (
        <SkeletonList rows={6} avatar={56} className="mt-5 px-5" />
      ) : received.isError || sent.isError ? (
        <SoftEmpty
          art={<CardsArt />}
          title="Couldn't load likes"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            received.refetch();
            sent.refetch();
          }}
          actionTestId="likes-retry-button"
          testId="error-alert"
        />
      ) : rows.length === 0 ? (
        <SoftEmpty
          art={<CardsArt />}
          title={superOnly ? "No Super Likes yet" : tab === "sent" ? "You haven't liked anyone yet" : "No likes yet"}
          description={superOnly ? "Super Likes you send or receive will show up here." : tab === "sent" ? "People you like show up here until they like you back." : "When someone likes you, they'll show up here."}
          actionIcon={Copy}
          actionLabel="Explore people"
          onAction={() => navigate("/explore")}
          actionTestId="likes-go-explore-button"
          footer="New connections are waiting"
        />
      ) : (
        <ul className="mt-5 flex flex-col gap-3 px-[clamp(14px,5cqi,20px)]" data-testid="likes-list">
          {rows.map((l, i) => {
            const p = l.user;
            const mine = l.direction === "sent";
            return (
              <motion.li key={`${l.direction}-${p.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween(D.base, Math.min(i, 8) * 0.03)} className="vo-soft-row gap-1 pr-2" data-testid="likes-row">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3.5 text-left focus-visible:outline-none" onClick={() => setSheet(l)} data-testid="likes-row-open">
                  <span className="relative shrink-0">
                    <UserPhoto src={p.photos?.[0]} name={p.name} size="sm" className="h-[56px] w-[56px] rounded-full text-xl" />
                    <span className={`absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-bg ${l.superlike ? "bg-blue" : "bg-red"} text-white`}>
                      {l.superlike ? <Star className="h-3 w-3" fill="currentColor" /> : <Heart className="h-3 w-3" fill="currentColor" />}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[17px] font-semibold tracking-[-0.01em] text-ink">
                      <span className="truncate">
                        {p.name} <span className="font-normal">{p.age}</span>
                      </span>
                      {p.verified && <VerifiedBadge size={17} testId="likes-row-verified" />}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[14px] text-mute" data-testid="likes-row-sub">
                      <span className={`h-1.5 w-1.5 rounded-full ${mine ? "bg-mute" : "bg-red"}`} />
                      {mine ? "You liked" : l.superlike ? "Super Liked you" : "Liked you"} {agoLabel(l.created_at)}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-mute" strokeWidth={2} />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="vo-icon-plain h-10 w-10 text-mute" aria-label="More" data-testid="likes-row-menu">
                      <MoreHorizontal className="h-6 w-6" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-[18px] border-0 bg-bg p-1.5 shadow-modal">
                    <DropdownMenuItem className="rounded-[10px] py-2.5" onClick={() => setSheet(l)}>
                      <UserRound className="mr-2 h-4 w-4" /> View profile
                    </DropdownMenuItem>
                    {!mine && (
                      <>
                        <DropdownMenuItem className="rounded-[10px] py-2.5" onClick={() => respond(p, "like")} data-testid="likes-like-back-button">
                          <Heart className="mr-2 h-4 w-4" /> Like back
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-[10px] py-2.5" onClick={() => respond(p, "pass")} data-testid="likes-pass-button">
                          <X className="mr-2 h-4 w-4" /> Pass
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="rounded-[10px] py-2.5" onClick={() => setReportTarget(p)}>
                      <ShieldAlert className="mr-2 h-4 w-4" /> Report
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-[10px] py-2.5 text-red focus:text-red" onClick={() => setBlockTarget(p)}>
                      <Ban className="mr-2 h-4 w-4" /> Block
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.li>
            );
          })}
        </ul>
      )}

      <ProfileSheet
        profile={sheetProfile}
        open={!!sheetProfile}
        onOpenChange={(o) => !o && setSheet(null)}
        note={isReceived ? `${sheetProfile?.name} ${sheet?.superlike ? "Super Liked" : "liked"} you ${agoLabel(sheet?.created_at)}` : `You liked ${sheetProfile?.name} ${agoLabel(sheet?.created_at)}`}
        onReact={isReceived ? (reaction) => sheetProfile && respond(sheetProfile, "like", reaction) : undefined}
        onBlock={() => {
          setBlockTarget(sheetProfile);
          setSheet(null);
        }}
        onReport={() => {
          setReportTarget(sheetProfile);
          setSheet(null);
        }}
        actions={
          sheetProfile &&
          (isReceived ? (
            <div className="flex items-center justify-center gap-6">
              <button type="button" className="vo-action h-14 w-14" onClick={() => respond(sheetProfile, "pass")} disabled={busy === sheetProfile.id} aria-label="Pass" data-testid="sheet-pass-button">
                <X className="h-6 w-6" strokeWidth={2.5} />
              </button>
              <button type="button" className="vo-action h-16 w-16" onClick={() => respond(sheetProfile, "like")} disabled={busy === sheetProfile.id} aria-label="Like back" data-testid="sheet-like-button">
                <Heart className="h-7 w-7" fill="currentColor" strokeWidth={2} />
              </button>
            </div>
          ) : sheet?.match_id ? (
            <button type="button" className="vo-btn-primary w-full" onClick={() => navigate(`/chats/${sheet.match_id}`)} data-testid="sheet-open-chat-button">
              <MessageCircle className="h-4 w-4" /> Open chat
            </button>
          ) : (
            <p className="text-center text-[14px] text-mute" data-testid="sheet-waiting">
              Waiting for {sheetProfile.name} to like you back.
            </p>
          ))
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
