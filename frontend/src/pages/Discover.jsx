import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Heart, Star, SlidersHorizontal, RefreshCw, SquareStack } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { useStats } from "@/hooks/useStats";
import { Brand } from "@/components/Logo";
import { SwipeCard } from "@/components/SwipeCard";
import { MatchModal } from "@/components/MatchModal";
import { ProfileSheet } from "@/components/ProfileSheet";
import { ConfirmDialog, ReportDialog } from "@/components/Dialogs";
import { EmptyState, Skeleton } from "@/components/EmptyState";

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
          toast(`Super Like sent to ${profile.name}`);
        }
      } catch (e) {
        toast.error(errMsg(e));
      }
    },
    [qc]
  );

  const voilasLeft = stats?.voilas_left;

  const trigger = (action, reaction = null) => {
    if (!queue.length) return;
    if (action === "superlike" && voilasLeft === 0) {
      toast.error(`You've used all ${stats?.voila_weekly_limit || 5} Super Likes this week.`);
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
      toast(`${blockTarget.name} is blocked`);
      setBlockTarget(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const doReport = async (reason, details) => {
    if (!reportTarget) return;
    setBusy(true);
    try {
      await api.post(`/users/${reportTarget.id}/report`, { reason, details });
      toast("Report received. Thank you.");
      setReportTarget(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const empty = !loading && queue.length === 0;
  const current = queue[0];
  const next = queue[1];

  return (
    <div className="flex h-full flex-col" data-testid="discover-page">
      <header className="flex h-14 items-center justify-between px-5 pt-2">
        <Brand />
        <button type="button" className="vo-icon-btn" onClick={() => navigate("/filters")} aria-label="Filters" data-testid="filters-open-button">
          <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      </header>

      <div className="relative mx-5 mt-2 min-h-0 flex-1" data-testid="discover-card-stack">
        {loading && queue.length === 0 ? (
          <Skeleton className="absolute inset-0 rounded-[28px]" />
        ) : error ? (
          <EmptyState
            icon={RefreshCw}
            title="Couldn't load people"
            description={error}
            testId="error-alert"
            action={
              <button type="button" className="vo-btn-primary w-full" onClick={() => load()} data-testid="discover-retry-button">
                Try again
              </button>
            }
          />
        ) : empty ? (
          <EmptyState
            icon={SquareStack}
            title="You've seen everyone nearby"
            description="New people join every day. Widen your distance or age range to see more."
            action={
              <button type="button" className="vo-btn-primary w-full" onClick={() => navigate("/filters")} data-testid="discover-adjust-filters-button">
                Adjust filters
              </button>
            }
            secondary={
              <button type="button" className="vo-btn-ghost w-full" onClick={() => load()} data-testid="discover-refresh-button">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            }
          />
        ) : (
          <>
            {next && <div className="absolute inset-0 scale-[0.96] translate-y-2 overflow-hidden rounded-[28px] bg-surface2" aria-hidden="true" />}
            <SwipeCard
              key={current.id}
              ref={topRef}
              profile={current}
              onSwipe={onSwipe}
              onOpen={(p) => setSheet(p)}
              onReport={(p) => setReportTarget(p)}
              onBlock={(p) => setBlockTarget(p)}
            />
          </>
        )}
      </div>

      {/* Three round actions */}
      <div className="flex items-center justify-center gap-6 pt-5" style={{ paddingBottom: "calc(74px + env(safe-area-inset-bottom))" }} data-testid="discover-action-dock">
        <button type="button" disabled={empty || loading} onClick={() => trigger("pass")} className="vo-action h-14 w-14" aria-label="Pass" data-testid="discover-pass-button">
          <X className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <button type="button" disabled={empty || loading} onClick={() => trigger("like")} className="vo-action h-16 w-16" aria-label="Like" data-testid="discover-like-button">
          <Heart className="h-7 w-7" fill="currentColor" strokeWidth={2} />
        </button>
        <button type="button" disabled={empty || loading} onClick={() => trigger("superlike")} className="vo-action h-14 w-14 text-blue" aria-label="Super Like" data-testid="discover-voila-button">
          <Star className="h-6 w-6" fill="currentColor" strokeWidth={2} />
        </button>
      </div>

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
            <button type="button" className="vo-action h-14 w-14 text-blue" onClick={() => fromSheet("superlike")} aria-label="Super Like" data-testid="sheet-superlike-button">
              <Star className="h-6 w-6" fill="currentColor" strokeWidth={2} />
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
