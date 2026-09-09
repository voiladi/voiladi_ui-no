import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLikesQuery } from "@/hooks/useBadges";
import { UserPhoto } from "@/components/UserPhoto";
import { PageHeader, EmptyState, Skeleton } from "@/components/EmptyState";
import { ProfileSheet } from "@/components/ProfileSheet";
import { MatchModal } from "@/components/MatchModal";
import { Tag } from "@/components/Chip";

export default function Likes() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useLikesQuery();
  const [sheet, setSheet] = useState(null);
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(null);
  const likes = data?.likes || [];

  const respond = async (profile, action) => {
    setBusy(profile.id);
    try {
      const { data: res } = await api.post("/swipe", { target_id: profile.id, action });
      qc.setQueryData(["likes"], (old) => (old ? { ...old, likes: old.likes.filter((l) => l.user.id !== profile.id), count: Math.max(0, old.count - 1) } : old));
      setSheet(null);
      if (res.matched) {
        setMatch(res.match);
        qc.invalidateQueries({ queryKey: ["matches"] });
      } else if (action === "pass") {
        toast("Passed");
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-full pb-28" data-testid="likes-page">
      <PageHeader title="Likes" subtitle={likes.length ? `${likes.length} ${likes.length === 1 ? "person likes" : "people like"} you. No pressure.` : "People who liked you show up here."} />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-4 pt-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-[22px]" />
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
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, type: "spring", stiffness: 300, damping: 26 }}
                className="relative overflow-hidden rounded-[22px] border border-line bg-white shadow-[var(--vo-shadow-soft)]"
                data-testid="likes-grid-tile"
              >
                <button type="button" className="block w-full text-left" onClick={() => setSheet(p)} data-testid="likes-tile-open">
                  <div className="relative aspect-[3/4]">
                    <UserPhoto src={p.photos?.[0]} name={p.name} className="h-full w-full text-5xl" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 to-transparent" />
                    {l.superlike && (
                      <Tag tone="voila" className="absolute left-2.5 top-2.5 h-7 px-2.5 text-[12px]">
                        <Zap className="h-3.5 w-3.5 fill-voila" /> Voila'd you
                      </Tag>
                    )}
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
                  <button type="button" className="vo-icon-btn h-10 flex-1 rounded-[12px] text-pass" onClick={() => respond(p, "pass")} disabled={busy === p.id} aria-label="Pass" data-testid="likes-pass-button">
                    <X className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    className="flex h-10 flex-[1.6] items-center justify-center gap-1.5 rounded-[12px] bg-brand text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark active:scale-95 disabled:opacity-50"
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
        profile={sheet}
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        actions={
          sheet && (
            <div className="flex gap-3">
              <button type="button" className="vo-btn-outline flex-1 text-pass" onClick={() => respond(sheet, "pass")} disabled={busy === sheet.id} data-testid="sheet-pass-button">
                <X className="h-5 w-5" /> Pass
              </button>
              <button type="button" className="vo-btn-primary flex-[1.4]" onClick={() => respond(sheet, "like")} disabled={busy === sheet.id} data-testid="sheet-like-button">
                <Heart className="h-5 w-5 fill-white" /> Like back
              </button>
            </div>
          )
        }
      />
      <MatchModal match={match} me={user} onClose={() => setMatch(null)} onSayHi={() => navigate(`/chats/${match.id}`)} />
    </div>
  );
}
