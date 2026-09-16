import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { GlassSegmented } from "@/components/GlassSegmented";
import { SoftSearch, SoftPill } from "@/components/SoftUI";
import { UserPhoto } from "@/components/UserPhoto";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ProfileSheet } from "@/components/ProfileSheet";
import { ConfirmDialog } from "@/components/Dialogs";
import { Skeleton } from "@/components/Loading";
import { api, errMsg } from "@/lib/api";
import { notice } from "@/lib/feedback";

/*
 * Followers / Following sheet (Instagram style), opened from the stats on your profile.
 *  - two tabs with live counts, search box, rows = avatar · name ✓ · @username
 *  - Followers: "Follow back" (a like) or "Following"; Following: "Following" -> confirm -> unfollow
 *  - tap a row -> their profile sheet
 * A follow is a like in Voiladi, so the lists mirror /me/stats exactly.
 */
const fetchList = (kind) => async () => (await api.get(`/me/${kind}`)).data;

export const useFollowers = (enabled) => useQuery({ queryKey: ["followers"], queryFn: fetchList("followers"), enabled, staleTime: 30_000 });
export const useFollowing = (enabled) => useQuery({ queryKey: ["following"], queryFn: fetchList("following"), enabled, staleTime: 30_000 });

const Row = ({ p, tab, onOpen, onFollow, onUnfollow, busy, last }) => {
  const following = p.followed_by_me;
  return (
    <div className={`flex items-center gap-3.5 py-[10px] ${last ? "" : "border-b border-line/70"}`} data-testid="follow-row" data-user-id={p.id}>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3.5 text-left focus-visible:outline-none active:opacity-80" onClick={() => onOpen(p)} data-testid="follow-row-open">
        <UserPhoto src={p.photos?.[0]} name={p.name} size="sm" className="h-[54px] w-[54px] shrink-0 rounded-full text-lg" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[16.5px] font-semibold leading-[20px] tracking-[-0.01em] text-ink">
            <span className="truncate">{p.name}</span>
            {p.verified && <VerifiedBadge size={16} inline />}
          </span>
          <span className="mt-[2px] block truncate text-[14.5px] leading-[18px] text-mute" data-testid="follow-row-sub">
            {p.username ? `@${p.username}` : p.job || p.city || ""}
            {tab === "followers" && p.followed_by_me && p.follows_me ? " · Follows you" : ""}
          </span>
        </span>
      </button>
      {following ? (
        <SoftPill active onClick={() => onUnfollow(p)} disabled={busy === p.id} testId="follow-row-following" className="h-[38px] min-w-[104px] px-4 text-[14.5px] font-semibold">
          Following
        </SoftPill>
      ) : (
        <SoftPill onClick={() => onFollow(p)} disabled={busy === p.id} testId="follow-row-follow" className="h-[38px] min-w-[104px] px-4 text-[14.5px] font-semibold">
          {tab === "followers" ? "Follow back" : "Follow"}
        </SoftPill>
      )}
    </div>
  );
};

const RowsSkeleton = () => (
  <div className="space-y-1 pt-1" aria-busy="true" data-testid="follow-list-loading">
    {[0, 1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-center gap-3.5 py-[10px]">
        <Skeleton className="h-[54px] w-[54px] rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-[14px] w-[40%]" />
          <Skeleton className="h-[12px] w-[28%]" />
        </div>
        <Skeleton className="h-[38px] w-[104px] rounded-full" />
      </div>
    ))}
  </div>
);

export const FollowListSheet = ({ open, tab, onTabChange, onOpenChange }) => {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [person, setPerson] = useState(null);
  const [unfollowTarget, setUnfollowTarget] = useState(null);
  const [busy, setBusy] = useState("");
  const followers = useFollowers(open);
  const following = useFollowing(open);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const active = tab === "following" ? following : followers;
  const list = active.data?.people || [];
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((p) => (p.name || "").toLowerCase().includes(s) || (p.username || "").toLowerCase().includes(s));
  }, [list, q]);

  const nFollowers = followers.data?.count;
  const nFollowing = following.data?.count;
  const options = [
    { value: "followers", label: nFollowers == null ? "Followers" : `${nFollowers} follower${nFollowers === 1 ? "" : "s"}` },
    { value: "following", label: nFollowing == null ? "Following" : `${nFollowing} following` },
  ];

  const openPerson = async (p) => {
    try {
      const { data } = await api.get(`/users/${p.id}`);
      setPerson(data);
    } catch (e) {
      notice(errMsg(e));
    }
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["followers"] });
    qc.invalidateQueries({ queryKey: ["following"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["likes-sent"] });
  };

  const patch = (id, changes) => {
    ["followers", "following"].forEach((k) =>
      qc.setQueryData([k], (old) => (old ? { ...old, people: old.people.map((p) => (p.id === id ? { ...p, ...changes } : p)) } : old))
    );
  };

  const follow = async (p) => {
    setBusy(p.id);
    patch(p.id, { followed_by_me: true });
    try {
      const { data } = await api.post("/swipe", { target_id: p.id, action: "like" });
      if (data.matched) {
        notice(`It's a match with ${p.name.split(" ")[0]}`);
        qc.invalidateQueries({ queryKey: ["matches"] });
      }
      refresh();
    } catch (e) {
      patch(p.id, { followed_by_me: false });
      notice(errMsg(e));
    } finally {
      setBusy("");
    }
  };

  const unfollow = async () => {
    const p = unfollowTarget;
    if (!p) return;
    setBusy(p.id);
    setUnfollowTarget(null);
    patch(p.id, { followed_by_me: false });
    try {
      await api.delete(`/follow/${p.id}`);
      refresh();
    } catch (e) {
      patch(p.id, { followed_by_me: true });
      notice(errMsg(e));
    } finally {
      setBusy("");
    }
  };

  const empty = tab === "followers"
    ? { title: q ? "No one found" : "No followers yet", sub: q ? "Try another name." : "People who like your profile show up here." }
    : { title: q ? "No one found" : "You're not following anyone", sub: q ? "Try another name." : "Follow people from Explore to see them here." };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="mx-auto h-[92dvh] max-w-[430px] rounded-t-[28px] border-0 bg-canvas [&>div:first-child]:hidden" data-testid="follow-list-sheet">
          <div className="mx-auto mt-3 h-[5px] w-12 shrink-0 rounded-full bg-surface2" aria-hidden="true" />
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-[calc(8px+var(--safe-bottom))]">
            <DrawerTitle className="sr-only">{tab === "followers" ? "Followers" : "Following"}</DrawerTitle>
            <DrawerDescription className="sr-only">People who follow you and people you follow</DrawerDescription>
            <GlassSegmented options={options} value={tab} onChange={onTabChange} testIdPrefix="follow-tab" className="vo-seg-inbox mt-3" />
            <div className="mt-3.5">
              <SoftSearch value={q} onChange={setQ} onClear={() => setQ("")} placeholder="Search" testId="follow-search" />
            </div>
            <div className="vo-scroll mt-1 min-h-0 flex-1 overflow-y-auto pb-6" data-testid="follow-list">
              {active.isLoading ? (
                <RowsSkeleton />
              ) : active.isError ? (
                <div className="mt-14 flex flex-col items-center text-center" data-testid="follow-list-error">
                  <p className="text-[16px] font-semibold text-ink">Couldn't load this list</p>
                  <SoftPill onClick={() => active.refetch()} className="mt-3 h-[40px] px-5 text-[15px] font-semibold">
                    Try again
                  </SoftPill>
                </div>
              ) : shown.length === 0 ? (
                <div className="mt-16 flex flex-col items-center px-6 text-center" data-testid="follow-list-empty">
                  <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-surface text-ink">
                    <Users className="h-8 w-8" strokeWidth={1.6} />
                  </span>
                  <p className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-ink">{empty.title}</p>
                  <p className="mt-1 text-[14.5px] leading-[19px] text-mute">{empty.sub}</p>
                </div>
              ) : (
                shown.map((p, i) => (
                  <Row key={p.id} p={p} tab={tab} busy={busy} onOpen={openPerson} onFollow={follow} onUnfollow={setUnfollowTarget} last={i === shown.length - 1} />
                ))
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <ProfileSheet profile={person} open={!!person} onOpenChange={(o) => !o && setPerson(null)} />

      <ConfirmDialog
        open={!!unfollowTarget}
        onOpenChange={(o) => !o && setUnfollowTarget(null)}
        title={`Unfollow ${unfollowTarget?.name?.split(" ")[0] || ""}?`}
        description="You'll stop following them. Any chat you already have stays."
        confirmText="Unfollow"
        danger
        onConfirm={unfollow}
        testId="unfollow-dialog"
      />
    </>
  );
};
