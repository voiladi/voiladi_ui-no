import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, MoreHorizontal, X, Heart, Star, UserRound, ShieldAlert, Ban, SearchX } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { Brand } from "@/components/Logo";
import { UserPhoto } from "@/components/UserPhoto";
import { Chip } from "@/components/Chip";
import { ProfileSheet } from "@/components/ProfileSheet";
import { MatchModal } from "@/components/MatchModal";
import { ConfirmDialog, ReportDialog } from "@/components/Dialogs";
import { EmptyState, Skeleton } from "@/components/EmptyState";
import { kmLabel } from "@/lib/format";
import { tween, D } from "@/lib/motion";

const TABS = [
  { key: "all", label: "All" },
  { key: "near", label: "Near you" },
  { key: "new", label: "New" },
  { key: "popular", label: "Popular" },
];

export default function Explore() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { meta } = useMeta();
  const [tab, setTab] = useState("all");
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(null);
  const [match, setMatch] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(() => new Set());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["explore", tab],
    queryFn: async () => (await api.get("/explore", { params: { tab, limit: 40 } })).data,
    staleTime: 30_000,
  });

  const people = useMemo(() => {
    const list = (data?.profiles || []).filter((p) => !gone.has(p.id));
    const s = q.trim().toLowerCase();
    return s ? list.filter((p) => p.name.toLowerCase().includes(s)) : list;
  }, [data, q, gone]);

  const remove = (id) => setGone((g) => new Set([...g, id]));

  const act = async (profile, action, reaction = null) => {
    setSheet(null);
    try {
      const { data: res } = await api.post("/swipe", { target_id: profile.id, action, reaction: reaction || undefined });
      remove(profile.id);
      qc.invalidateQueries({ queryKey: ["likes-sent"] });
      if (res.matched) {
        setMatch(res.match);
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
      } else if (action === "superlike") {
        toast(`Super Like sent to ${profile.name}`);
        qc.invalidateQueries({ queryKey: ["stats"] });
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const doBlock = async () => {
    if (!blockTarget) return;
    setBusy(true);
    try {
      await api.post(`/users/${blockTarget.id}/block`);
      remove(blockTarget.id);
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

  return (
    <div className="min-h-full pb-24" data-testid="explore-page">
      <header className="px-4 pt-1">
        <div className="flex h-14 items-center justify-between">
          <Brand size={30} />
          <button type="button" className={`vo-icon-btn ${searching ? "bg-ink text-onink hover:bg-ink" : ""}`} onClick={() => setSearching((s) => !s)} aria-label="Search" data-testid="explore-search-button">
            <Search className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <h1 className="vo-title mt-2">Explore</h1>
        <p className="mt-1 text-[15px] text-mute">Find people who vibe with you.</p>
        {searching && (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            <input autoFocus className="vo-input h-11 pl-11 text-[15px]" style={{ height: 44 }} placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} data-testid="explore-search-input" />
          </div>
        )}
        <div className="no-scrollbar mt-4 flex gap-2.5 overflow-x-auto" data-testid="explore-tabs">
          {TABS.map((t) => (
            <Chip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} className="shrink-0" data-testid={`explore-tab-${t.key}`}>
              {t.label}
            </Chip>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-4 pt-5" data-testid="explore-loading">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-[20px]" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={SearchX}
          title="Couldn't load people"
          description="Check your connection and try again."
          testId="error-alert"
          action={
            <button type="button" className="vo-btn-primary w-full" onClick={() => refetch()}>
              Try again
            </button>
          }
        />
      ) : people.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={q ? `No one named "${q}"` : tab === "near" ? "No one nearby yet" : "No one to show yet"}
          description={tab === "near" && !user?.city ? "Add your location in Edit Profile to see people near you." : "Try another tab or widen your filters."}
          action={
            <button type="button" className="vo-btn-primary w-full" onClick={() => navigate("/filters")} data-testid="explore-adjust-filters-button">
              Adjust filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pt-5" data-testid="explore-grid">
          {people.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween(D.base, Math.min(i, 8) * 0.03)} className="relative aspect-[3/4] overflow-hidden rounded-[20px] bg-surface2" data-testid="explore-tile">
              <button type="button" className="block h-full w-full text-left focus-visible:outline-none" onClick={() => setSheet(p)} data-testid="explore-tile-open">
                <UserPhoto src={p.photos?.[0]} name={p.name} className="h-full w-full text-4xl" />
                <div className="vo-photo-fade pointer-events-none absolute inset-x-0 bottom-0 h-1/2" />
                <div className="pointer-events-none absolute inset-x-3 bottom-3 text-white">
                  <div className="text-[18px] font-bold leading-tight tracking-[-0.01em]">
                    {p.name} <span className="font-medium">{p.age}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-white/90">
                    <span className={`h-2 w-2 rounded-full ${p.distance_km !== null && p.distance_km !== undefined && p.distance_km <= 5 ? "bg-amber" : "bg-white/70"}`} />
                    {kmLabel(p.distance_km, p.city) || "Nearby"}
                  </div>
                </div>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full text-white focus-visible:outline-none" aria-label="More" data-testid="explore-tile-menu">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-[16px] border-line bg-bg p-1.5 shadow-modal">
                  <DropdownMenuItem className="rounded-[10px] py-2.5" onClick={() => setSheet(p)}>
                    <UserRound className="mr-2 h-4 w-4" /> View profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="rounded-[10px] py-2.5" onClick={() => setReportTarget(p)}>
                    <ShieldAlert className="mr-2 h-4 w-4" /> Report
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-[10px] py-2.5 text-red focus:text-red" onClick={() => setBlockTarget(p)}>
                    <Ban className="mr-2 h-4 w-4" /> Block
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </div>
      )}

      <ProfileSheet
        profile={sheet}
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        onReact={(reaction) => sheet && act(sheet, "like", reaction)}
        onBlock={() => {
          setBlockTarget(sheet);
          setSheet(null);
        }}
        onReport={() => {
          setReportTarget(sheet);
          setSheet(null);
        }}
        actions={
          sheet && (
            <div className="flex items-center justify-center gap-6">
              <button type="button" className="vo-action h-14 w-14" onClick={() => act(sheet, "pass")} aria-label="Pass" data-testid="sheet-pass-button">
                <X className="h-6 w-6" strokeWidth={2.5} />
              </button>
              <button type="button" className="vo-action h-16 w-16" onClick={() => act(sheet, "like")} aria-label="Like" data-testid="sheet-like-button">
                <Heart className="h-7 w-7" fill="currentColor" strokeWidth={2} />
              </button>
              <button type="button" className="vo-action h-14 w-14 text-blue" onClick={() => act(sheet, "superlike")} aria-label="Super Like" data-testid="sheet-superlike-button">
                <Star className="h-6 w-6" fill="currentColor" strokeWidth={2} />
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
        loading={busy}
        onConfirm={doBlock}
        testId="block-dialog"
      />
      <ReportDialog open={!!reportTarget} onOpenChange={(o) => !o && setReportTarget(null)} reasons={meta.report_reasons} onSubmit={doReport} loading={busy} name={reportTarget?.name} />
    </div>
  );
}
