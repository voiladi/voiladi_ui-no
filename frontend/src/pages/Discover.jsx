import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { X, Heart, Zap, SlidersHorizontal, RefreshCw, Compass } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { Logo } from "@/components/Logo";
import { CardStack } from "@/components/SwipeCard";
import { MatchModal } from "@/components/MatchModal";
import { FiltersDrawer } from "@/components/FiltersDrawer";
import { ProfileSheet } from "@/components/ProfileSheet";
import { ConfirmDialog, ReportDialog } from "@/components/Dialogs";
import { EmptyState, Skeleton } from "@/components/EmptyState";

export default function Discover() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, setUser } = useAuth();
  const { meta } = useMeta();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [match, setMatch] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const topRef = useRef(null);
  const swiped = useRef(new Set());

  const load = useCallback(
    async (silent = false) => {
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
    },
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && queue.length === 1) load(true);
  }, [queue.length, loading, load]);

  const onSwipe = useCallback(
    async (profile, action, reaction = null) => {
      swiped.current.add(profile.id);
      setQueue((q) => q.filter((p) => p.id !== profile.id));
      try {
        const { data } = await api.post("/swipe", { target_id: profile.id, action, reaction: reaction || undefined });
        if (data.matched) {
          setMatch(data.match);
          qc.invalidateQueries({ queryKey: ["matches"] });
          qc.invalidateQueries({ queryKey: ["likes"] });
        } else if (action === "superlike") {
          toast(`Voila sent to ${profile.name}. They'll see you first.`);
        } else if (reaction) {
          toast(`You liked ${profile.name}'s ${reaction.type === "photo" ? "photo" : "answer"}`);
        }
      } catch (e) {
        toast.error(errMsg(e));
      }
    },
    [qc]
  );

  const trigger = (action, reaction = null) => {
    if (!queue.length) return;
    topRef.current?.swipe(action, reaction);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (sheet || match || filtersOpen || blockTarget || reportTarget) return;
      if (e.key === "ArrowRight") trigger("like");
      if (e.key === "ArrowLeft") trigger("pass");
      if (e.key === "ArrowUp") trigger("superlike");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, sheet, match, filtersOpen, blockTarget, reportTarget]);

  const applyPrefs = async (prefs) => {
    setSavingPrefs(true);
    try {
      const { data } = await api.put("/preferences", prefs);
      setUser((u) => ({ ...u, preferences: data, looking_for: data.show_me }));
      setFiltersOpen(false);
      swiped.current = new Set();
      setQueue([]);
      await load();
      toast.success("Feed updated");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSavingPrefs(false);
    }
  };

  const anywhere = async () => {
    await applyPrefs({ ...(user?.preferences || {}), max_distance_km: meta.anywhere_km || 250 });
  };

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
      toast(`${blockTarget.name} is blocked. They won't see you again.`);
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
      toast.success("Thanks. We've received your report and will review it.");
      setReportTarget(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const empty = !loading && queue.length === 0;

  return (
    <div className="flex h-full flex-col" data-testid="discover-page">
      <header className="flex items-center justify-between px-5 pb-2 pt-4">
        <Logo size={32} textClass="text-[21px]" />
        <button type="button" className="vo-icon-btn" onClick={() => setFiltersOpen(true)} aria-label="Filters" data-testid="filters-open-button">
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1 px-4 pb-2 pt-1">
        {loading && queue.length === 0 ? (
          <div className="absolute inset-x-4 inset-y-1">
            <Skeleton className="h-full w-full rounded-[30px]" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center">
            <EmptyState
              icon={RefreshCw}
              title="Couldn't load people"
              description={error}
              testId="error-alert"
              action={
                <button type="button" className="vo-btn-primary" onClick={() => load()} data-testid="discover-retry-button">
                  Try again
                </button>
              }
            />
          </div>
        ) : empty ? (
          <div className="flex h-full items-center">
            <EmptyState
              icon={Compass}
              title="You've seen everyone nearby"
              description="New people join every day. Widen your distance or age range to see more right now."
              action={
                <div className="flex flex-col gap-2">
                  {(user?.preferences?.max_distance_km || 250) < (meta.anywhere_km || 250) && (
                    <button type="button" className="vo-btn-primary" onClick={anywhere} disabled={savingPrefs} data-testid="discover-anywhere-button">
                      Show people anywhere
                    </button>
                  )}
                  <button type="button" className="vo-btn-secondary" onClick={() => setFiltersOpen(true)} data-testid="discover-adjust-filters-button">
                    Adjust filters
                  </button>
                  <button type="button" className="vo-btn-ghost" onClick={() => load()} data-testid="discover-refresh-button">
                    <RefreshCw className="h-4 w-4" /> Refresh
                  </button>
                </div>
              }
            />
          </div>
        ) : (
          <CardStack profiles={queue} onSwipe={onSwipe} onOpen={(p) => setSheet(p)} topRef={topRef} />
        )}
      </div>

      <div className="flex items-center justify-center gap-5 pb-[92px] pt-3" data-testid="discover-action-dock">
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          disabled={empty || loading}
          onClick={() => trigger("pass")}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white text-pass shadow-[var(--vo-shadow-soft)] disabled:opacity-40"
          aria-label="Pass"
          data-testid="discover-pass-button"
        >
          <X className="h-7 w-7" strokeWidth={2.6} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          disabled={empty || loading}
          onClick={() => trigger("superlike")}
          className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-ink text-white shadow-[0_14px_34px_rgba(11,18,32,0.28)] disabled:opacity-40"
          aria-label="Voila"
          data-testid="discover-voila-button"
        >
          <Zap className="h-7 w-7 fill-[#5AC8FA] text-[#5AC8FA]" strokeWidth={2.2} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          disabled={empty || loading}
          onClick={() => trigger("like")}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white text-brand shadow-[var(--vo-shadow-soft)] disabled:opacity-40"
          aria-label="Like"
          data-testid="discover-like-button"
        >
          <Heart className="h-7 w-7 fill-brand" strokeWidth={2.4} />
        </motion.button>
      </div>

      <MatchModal match={match} me={user} onClose={() => setMatch(null)} onSayHi={() => navigate(`/chats/${match.id}`)} />
      <FiltersDrawer open={filtersOpen} onOpenChange={setFiltersOpen} prefs={user?.preferences} onApply={applyPrefs} saving={savingPrefs} anywhereKm={meta.anywhere_km} />
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
          <div className="flex gap-3">
            <button type="button" className="vo-btn-outline flex-1 text-pass" onClick={() => fromSheet("pass")} data-testid="sheet-pass-button">
              <X className="h-5 w-5" /> Pass
            </button>
            <button type="button" className="vo-btn-primary flex-[1.4]" onClick={() => fromSheet("like")} data-testid="sheet-like-button">
              <Heart className="h-5 w-5 fill-white" /> Like
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
