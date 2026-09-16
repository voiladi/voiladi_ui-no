import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Users } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { api } from "@/lib/api";
import { SoftSearch } from "@/components/SoftUI";
import { UserPhoto } from "@/components/UserPhoto";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { SkeletonList } from "@/components/Loading";

export const TAG_MAX = 20;

const useDebounced = (v, ms = 250) => {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
};

const norm = (p) => ({
  id: p.id,
  name: p.name || "Someone",
  username: p.username || "",
  photo: p.photo || p.photos?.[0] || null,
  verified: !!p.verified,
});

/*
 * "Tag people" (Instagram): search any account, tap to toggle a tag; the chosen people sit as chips under the search.
 * `selected` is a list of { id, name, username, photo, verified }.
 */
export const TagPeopleSheet = ({ open, onOpenChange, selected = [], onChange }) => {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const following = useQuery({
    queryKey: ["following"],
    queryFn: async () => (await api.get("/me/following")).data,
    enabled: open && !dq,
    staleTime: 60_000,
  });
  const search = useQuery({
    queryKey: ["tag-search", dq],
    queryFn: async () => (await api.get("/search", { params: { q: dq, limit: 30 } })).data,
    enabled: open && dq.length > 0,
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    if (dq) return (search.data?.profiles || []).filter((p) => !p.is_me).map(norm);
    return (following.data?.people || []).map(norm);
  }, [dq, search.data, following.data]);

  const loading = dq ? search.isLoading : following.isLoading;
  const isOn = (id) => selected.some((s) => s.id === id);
  const toggle = (p) => {
    if (isOn(p.id)) onChange(selected.filter((s) => s.id !== p.id));
    else if (selected.length < TAG_MAX) onChange([...selected, p]);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto h-[90dvh] max-w-[430px] rounded-t-[28px] border-0 bg-canvas [&>div:first-child]:hidden" data-testid="tag-people-sheet">
        <div className="mx-auto mt-3 h-[5px] w-12 shrink-0 rounded-full bg-surface2" aria-hidden="true" />
        <div className="flex min-h-0 flex-1 flex-col pb-[calc(8px+var(--safe-bottom))]">
          <div className="relative flex h-[52px] shrink-0 items-center justify-center px-5">
            <DrawerTitle className="text-[17px] font-bold tracking-[-0.01em] text-ink">Tag people</DrawerTitle>
            <DrawerDescription className="sr-only">Search for people to tag in this post</DrawerDescription>
            <button type="button" onClick={() => onOpenChange(false)} className="absolute right-5 text-[16px] font-semibold text-blue active:opacity-60" data-testid="tag-people-done">
              Done
            </button>
          </div>
          <div className="px-5">
            <SoftSearch value={q} onChange={setQ} onClear={() => setQ("")} placeholder="Search" testId="tag-people-search" />
          </div>
          {selected.length > 0 && (
            <div className="vo-scroll-x mt-3 flex gap-2 overflow-x-auto px-5" style={{ scrollbarWidth: "none" }} data-testid="tag-people-selected">
              {selected.map((p) => (
                <span key={p.id} className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-surface2 pl-1 pr-2.5" data-testid="tag-chip">
                  <UserPhoto src={p.photo} name={p.name} size="xs" className="h-[26px] w-[26px] rounded-full text-[11px]" />
                  <span className="text-[14px] font-semibold text-ink">{p.username || p.name}</span>
                  <button type="button" onClick={() => toggle(p)} aria-label={`Remove ${p.name}`} className="text-mute active:opacity-60" data-testid="tag-chip-remove">
                    <X className="h-4 w-4" strokeWidth={2.4} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="vo-scroll mt-2 min-h-0 flex-1 overflow-y-auto px-5 pb-4" data-testid="tag-people-list">
            {!dq && rows.length > 0 && <p className="pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-mute">People you follow</p>}
            {loading ? (
              <SkeletonList rows={6} avatar={46} />
            ) : rows.length === 0 ? (
              <div className="mt-16 flex flex-col items-center px-6 text-center" data-testid="tag-people-empty">
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-surface text-ink">
                  <Users className="h-8 w-8" strokeWidth={1.6} />
                </span>
                <p className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-ink">{dq ? "No one found" : "Search for people"}</p>
                <p className="mt-1 text-[14.5px] leading-[19px] text-mute">{dq ? "Try their @username." : "Type a name or @username to tag them."}</p>
              </div>
            ) : (
              rows.map((p) => {
                const on = isOn(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => toggle(p)} className="flex h-[64px] w-full items-center gap-3 text-left focus-visible:outline-none active:opacity-80" aria-pressed={on} data-testid="tag-people-row" data-user-id={p.id}>
                    <UserPhoto src={p.photo} name={p.name} size="xs" className="h-[46px] w-[46px] shrink-0 rounded-full text-[16px]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[15.5px] font-semibold tracking-[-0.01em] text-ink">
                        <span className="truncate">{p.username || p.name}</span>
                        {p.verified && <VerifiedBadge size={15} />}
                      </span>
                      <span className="block truncate text-[14px] text-mute">{p.name}</span>
                    </span>
                    <span className={`flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full ${on ? "bg-blue text-white" : "border-[1.5px] border-mute/70"}`} style={{ transitionProperty: "background-color", transitionDuration: "150ms" }} aria-hidden="true">
                      {on && <Check className="h-[15px] w-[15px]" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
