import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Heart, Star, SlidersHorizontal, RefreshCw, SquareStack, Sparkles, ChevronRight } from "lucide-react";
import { notice } from "@/lib/feedback";
import { useQueryClient } from "@tanstack/react-query";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { useStats } from "@/hooks/useStats";
import { SoftHeader, SoftIconButton, SoftTitle, SoftCard, SoftPill } from "@/components/SoftUI";
import { completion } from "@/pages/Profile";
import { SwipeCard } from "@/components/SwipeCard";
import { MatchModal } from "@/components/MatchModal";
import { ProfileSheet } from "@/components/ProfileSheet";
import { ConfirmDialog, ReportDialog } from "@/components/Dialogs";
import { Skeleton } from "@/components/EmptyState";

export default function Discover() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { meta } = useMeta();
  const { data: stats } = useStats();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [match, setMatch] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const topRef = useRef(null);
  const swiped = useRef(new Set());
  const prefsKey = JSON.stringify(user?.preferences || {});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/discover", { params: { limit: 20 } });
      setQueue((q) => {
        const ids = new Set(q.map((p) => p.id));
        const fresh = data.profiles.filter((p) => !ids.has(p.id) && !swiped.current.has(p.id));
        return [...q, ...fresh];
      });
    } catch (e) {
      setError(errMsg(e, "Couldn't load people right now."));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload the deck whenever filters change.
  useEffect(() => {
    swiped.current = new Set();
    setQueue([]);
    load();
  }, [load, prefsKey]);

  useEffect(() => {
    if (!loading && queue.length === 1) load(true);
  }, [queue.length, loading, load]);

  const onSwipe = useCallback(
    async (profile, action, reaction = null) => {
      swiped.current.add(profile.id);
      setQueue((q) => q.filter((p) => p.id !== profile.id));
      try {
        const { data } = await api.post("/swipe", { target_id: profile.id, action, reaction: reaction || undefined });
        if (action !== "pass") qc.invalidateQueries({ queryKey: ["likes-sent"] });
        if (action === "superlike") qc.invalidateQueries({ queryKey: ["stats"] });
        if (data.matched) {
          setMatch(data.match);
          qc.invalidateQueries({ queryKey: ["matches"] });
          qc.invalidateQueries({ queryKey: ["likes"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
        } else if (action === "superlike") {
        }
      } catch (e) {
        notice(errMsg(e));
      }
    },
    [qc]
  );

  const voilasLeft = stats?.voilas_left;

  const trigger = (action, reaction = null) => {
    if (!queue.length) return;
    if (action === "superlike" && voilasLeft === 0) {
      notice(`You've used all ${stats?.voila_weekly_limit || 5} Super Likes this week.`);
      return;
    }
    topRef.current?.swipe(action, reaction);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (sheet || match || blockTarget || reportTarget) return;
      if (e.key === "ArrowRight") trigger("like");
      if (e.key === "ArrowLeft") trigger("pass");
      if (e.key === "ArrowUp") trigger("superlike");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, sheet, match, blockTarget, reportTarget, voilasLeft]);

  const fromSheet = (action, reaction = null) => {
    setSheet(null);
    setTimeout(() => trigger(action, reaction), 150);
  };

  const doBlock = async () => {
    if (!blockTarget) return;
    setBusy(true);
    try {
      await api.post(`/users/${blockTarget.id}/block`);
      swiped.current.add(blockTarget.id);
      setQueue((q) => q.filter((p) => p.id !== blockTarget.id));
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["likes"] });
      setBlockTarget(null);
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const doReport = async (reason, details) => {
    if (!reportTarget) return;
    setBusy(true);
    try {
      await api.post(`/users/${reportTarget.id}/report`, { reason, details });
      return true;
    } catch (e) {
      notice(errMsg(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const empty = !loading && queue.length === 0;
  const current = queue[0];
  const next = queue[1];

  const { pct } = completion(user);
  const tipCard = pct < 100;

  const message = (icon, title, text, primary, onPrimary, primaryTestId, secondary, onSecondary, secondaryTestId, testId) => {
    const Icon = icon;
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center" data-testid={testId}>
        <span className="vo-soft-tile h-16 w-16 rounded-[20px] text-ink">
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <p className="mt-5 text-[22px] font-bold leading-[28px] tracking-[-0.02em] text-ink">{title}</p>
        <p className="mt-1.5 max-w-[280px] text-[16px] leading-[22px] text-mute">{text}</p>
        <SoftPill className="mt-6 h-[50px] px-7" onClick={onPrimary} testId={primaryTestId}>
          {primary}
        </SoftPill>
        {secondary && (
          <button type="button" className="mt-4 text-[16px] font-medium text-mute active:opacity-60" onClick={onSecondary} data-testid={secondaryTestId}>
            {secondary}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="vo-neu-page flex h-full flex-col" style={{ paddingBottom: "calc(var(--nav-h) + var(--nav-gap) + 14px + env(safe-area-inset-bottom, 0px))" }} data-testid="discover-page">
      <header className="shrink-0 px-5 pt-1">
        <SoftHeader right={<SoftIconButton icon={SlidersHorizontal} label="Filters" onClick={() => navigate("/filters")} testId="filters-open-button" />} />
        <SoftTitle title="Discover" subtitle="Find people who vibe with you" testId="discover-title" />
      </header>

      {/* photo card + the three round actions live on one raised surface */}
      <SoftCard className="mx-4 mt-4 flex min-h-0 flex-1 flex-col p-2.5 pb-4" testId="discover-deck">
        <div className="relative min-h-0 flex-1" data-testid="discover-card-stack">
          {loading && queue.length === 0 ? (
            <Skeleton className="absolute inset-0 rounded-[26px]" />
          ) : error ? (
            message(RefreshCw, "Couldn't load people", error, "Try again", () => load(), "discover-retry-button", null, null, null, "error-alert")
          ) : empty ? (
            message(SquareStack, "You've seen everyone nearby", "New people join every day. Widen your distance or age range to see more.", "Adjust filters", () => navigate("/filters"), "discover-adjust-filters-button", "Refresh", () => load(), "discover-refresh-button", "empty-state")
          ) : (
            <>
              {next && <div className="absolute inset-0 translate-y-2 scale-[0.96] overflow-hidden rounded-[26px] bg-surface2" aria-hidden="true" />}
              <SwipeCard key={current.id} ref={topRef} profile={current} onSwipe={onSwipe} onOpen={(p) => setSheet(p)} />
            </>
          )}
        </div>

        <div className="mt-4 flex shrink-0 items-center justify-center gap-[34px]" data-testid="discover-action-dock">
          <button type="button" disabled={empty || loading} onClick={() => trigger("pass")} className="vo-soft-round h-[76px] w-[76px]" aria-label="Pass" data-testid="discover-pass-button">
            <X className="h-8 w-8" strokeWidth={2.4} />
          </button>
          <button type="button" disabled={empty || loading} onClick={() => trigger("like")} className="vo-soft-round h-[76px] w-[76px]" aria-label="Like" data-testid="discover-like-button">
            <Heart className="h-[34px] w-[34px]" fill="currentColor" strokeWidth={2} />
          </button>
          <button type="button" disabled={empty || loading} onClick={() => trigger("superlike")} className="vo-soft-round h-[76px] w-[76px]" aria-label="Super Like" data-testid="discover-voila-button">
            <Star className="h-8 w-8" strokeWidth={2.2} />
          </button>
        </div>
      </SoftCard>

      {tipCard && (
        <SoftCard as="button" type="button" className="mx-4 mt-4 flex shrink-0 items-center gap-4 p-3.5 text-left focus-visible:outline-none active:opacity-90" onClick={() => navigate("/profile/edit")} testId="discover-tip-card">
          <span className="vo-soft-tile h-[60px] w-[60px] rounded-[18px]">
            <Sparkles className="h-7 w-7" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-bold leading-[22px] tracking-[-0.01em] text-ink">Better matches ahead</span>
            <span className="mt-0.5 block text-[15px] leading-[20px] text-mute">Complete your profile to get more relevant matches.</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-mute" strokeWidth={2} />
        </SoftCard>
      )}

      <MatchModal match={match} me={user} onClose={() => setMatch(null)} onSayHi={() => navigate(`/chats/${match.id}`)} />
      <ProfileSheet
        profile={sheet}
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        onReact={(reaction) => fromSheet("like", reaction)}
        onBlock={() => {
          setBlockTarget(sheet);
          setSheet(null);
        }}
        onReport={() => {
          setReportTarget(sheet);
          setSheet(null);
        }}
        actions={
          <div className="flex items-center justify-center gap-6">
            <button type="button" className="vo-action h-14 w-14" onClick={() => fromSheet("pass")} aria-label="Pass" data-testid="sheet-pass-button">
              <X className="h-6 w-6" strokeWidth={2.5} />
            </button>
            <button type="button" className="vo-action h-16 w-16" onClick={() => fromSheet("like")} aria-label="Like" data-testid="sheet-like-button">
              <Heart className="h-7 w-7" fill="currentColor" strokeWidth={2} />
            </button>
            <button type="button" className="vo-action h-14 w-14" onClick={() => fromSheet("superlike")} aria-label="Super Like" data-testid="sheet-superlike-button">
              <Star className="h-6 w-6" strokeWidth={2.2} />
            </button>
          </div>
        }
      />
      <ConfirmDialog
        open={!!blockTarget}
        onOpenChange={(o) => !o && setBlockTarget(null)}
        title={`Block ${blockTarget?.name}?`}
        description="They won't be able to see your profile or message you, and you won't see them again. They won't be notified."
        confirmText="Block"
        danger
        loading={busy}
        onConfirm={doBlock}
        testId="block-dialog"
      />
      <ReportDialog open={!!reportTarget} onOpenChange={(o) => !o && setReportTarget(null)} reasons={meta.report_reasons} onSubmit={doReport} loading={busy} name={reportTarget?.name} />
    </div>
  );
}
