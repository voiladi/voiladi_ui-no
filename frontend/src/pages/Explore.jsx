import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, X, Heart, Star, Users } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { UserPhoto } from "@/components/UserPhoto";
import { ProfileSheet } from "@/components/ProfileSheet";
import { MatchModal } from "@/components/MatchModal";
import { ConfirmDialog, ReportDialog } from "@/components/Dialogs";
import { Skeleton } from "@/components/EmptyState";
import { GlassSegmented } from "@/components/GlassSegmented";
import { SoftHeader, SoftIconButton, SoftTitle, SoftCard, SectionHead, SoftSearch, SoftPill } from "@/components/SoftUI";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { kmLabel } from "@/lib/format";
import { tween, D } from "@/lib/motion";

/*
 * Explore, transcribed from the reference: brand header with search + filters buttons, "Explore / Find people,
 * interests, and communities", sunken search field, glass segments People / Topics / Nearby / Creators, then
 * "Trending now" (2x2 community photo tiles), "Suggested for you" (people with Follow) and "Popular interests" chips.
 * Follow = a like. Tapping a community opens its members. Search filters people and communities live.
 */
const TABS = [
  { value: "people", label: "People" },
  { value: "topics", label: "Topics" },
  { value: "nearby", label: "Nearby" },
  { value: "creators", label: "Creators" },
];

const NAV_PAD = "calc(var(--nav-h) + var(--nav-gap) + 14px + env(safe-area-inset-bottom, 0px))";

const useTopics = () =>
  useQuery({
    queryKey: ["explore-topics"],
    queryFn: async () => (await api.get("/explore/topics")).data,
    staleTime: 60_000,
  });

const usePeople = (tab) =>
  useQuery({
    queryKey: ["explore", tab],
    queryFn: async () => (await api.get("/explore", { params: { tab, limit: 40 } })).data,
    staleTime: 30_000,
  });

/* Community photo tile: title + member count over a darkened photo. */
const TopicTile = ({ topic, onOpen, testId = "explore-topic-tile", className = "" }) => (
  <button type="button" onClick={() => onOpen(topic)} className={`relative block overflow-hidden rounded-[18px] bg-surface2 text-left focus-visible:outline-none active:opacity-90 ${className}`} data-testid={testId}>
    {topic.cover ? (
      <img src={topic.cover} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" draggable={false} />
    ) : (
      <span className="absolute inset-0 flex items-center justify-center text-mute">
        <Users className="h-9 w-9" strokeWidth={1.5} />
      </span>
    )}
    <span className="vo-tile-fade absolute inset-x-0 bottom-0 h-[70%]" />
    <span className="absolute inset-x-3.5 bottom-3 text-white">
      <span className="block truncate text-[clamp(16px,5cqi,20px)] font-bold leading-[1.2] tracking-[-0.01em]">{topic.name}</span>
      <span className="block text-[13px] leading-[17px] text-white/90" data-testid={`${testId}-members`}>
        {topic.members_label}
      </span>
    </span>
  </button>
);

/* Person row: avatar, name, what they do, Follow. */
const PersonRow = ({ p, sub, onOpen, onFollow, followed, followedLabel = "Following", isMe = false, last = false, testId = "explore-person-row" }) => (
  <div className={`flex items-center gap-4 py-3 ${last ? "" : "border-b border-line/80"}`} data-testid={testId}>
    <button type="button" className="flex min-w-0 flex-1 items-center gap-4 text-left focus-visible:outline-none" onClick={() => onOpen(p)} data-testid={`${testId}-open`}>
      <UserPhoto src={p.photos?.[0]} name={p.name} size="sm" className="h-[60px] w-[60px] shrink-0 rounded-full text-xl" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[clamp(16px,4.6cqi,18px)] font-bold leading-[1.22] tracking-[-0.01em] text-ink">
          <span className="truncate">{p.name}</span>
          {p.verified && <VerifiedBadge size={17} testId={`${testId}-verified`} />}
        </span>
        <span className="mt-0.5 block truncate text-[15px] leading-[19px] text-mute">{sub}</span>
      </span>
    </button>
    {isMe ? (
      <SoftPill active onClick={() => onOpen(p)} testId={`${testId}-me`} className="h-[44px] min-w-[clamp(80px,22cqi,96px)] px-[clamp(14px,4cqi,20px)] text-[clamp(15px,4.3cqi,17px)]">
        You
      </SoftPill>
    ) : (
      <SoftPill active={followed} onClick={() => !followed && onFollow(p)} testId={`${testId}-follow`} aria-pressed={followed} className="h-[44px] min-w-[clamp(92px,27cqi,112px)] px-[clamp(14px,4cqi,20px)] text-[clamp(15px,4.3cqi,17px)]">
        {followed ? followedLabel : "Follow"}
      </SoftPill>
    )}
  </div>
);

const RowSkeleton = ({ rows = 3 }) => (
  <div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 py-3">
        <Skeleton className="h-[60px] w-[60px] rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="mt-2 h-3 w-24 rounded-full" />
        </div>
        <Skeleton className="h-[44px] w-[112px] rounded-full" />
      </div>
    ))}
  </div>
);

const whatTheyDo = (p) => p.job || (p.username ? `@${p.username}` : p.city ? `Lives in ${p.city}` : "New here");

export default function Explore() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { meta } = useMeta();
  const [tab, setTab] = useState("people");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(null);
  const [topic, setTopic] = useState(null);
  const [showAllSuggested, setShowAllSuggested] = useState(false);
  const [match, setMatch] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [followed, setFollowed] = useState(() => new Set());
  const [gone, setGone] = useState(() => new Set());
  const searchRef = useRef(null);

  const topics = useTopics();
  const people = usePeople(tab === "topics" ? "people" : tab);
  const topicPeople = useQuery({
    queryKey: ["explore-topic", topic?.name],
    queryFn: async () => (await api.get(`/explore/topics/${encodeURIComponent(topic.name)}`)).data,
    enabled: !!topic,
    staleTime: 30_000,
  });

  useEffect(() => setShowAllSuggested(false), [tab]);

  const list = useMemo(() => (people.data?.profiles || []).filter((p) => !gone.has(p.id)), [people.data, gone]);
  const s = q.trim().toLowerCase();

  /* Instagram-style search: debounced, server-side, across every account (@username first, then names) + communities */
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(s), 220);
    return () => clearTimeout(t);
  }, [s]);
  const search = useQuery({
    queryKey: ["search", term],
    queryFn: async () => (await api.get("/search", { params: { q: term, limit: 30 } })).data,
    enabled: term.length > 0,
    staleTime: 15_000,
    keepPreviousData: true,
  });
  const searching = s.length > 0 && (search.isLoading || term !== s);
  const searchPeople = useMemo(() => (search.data?.profiles || []).filter((p) => !gone.has(p.id)), [search.data, gone]);
  const searchTopics = search.data?.topics || [];

  const remove = (id) => setGone((g) => new Set([...g, id]));

  const follow = async (profile, action = "like", reaction = null) => {
    try {
      const { data: res } = await api.post("/swipe", { target_id: profile.id, action, reaction: reaction || undefined });
      setFollowed((f) => new Set([...f, profile.id]));
      qc.invalidateQueries({ queryKey: ["likes-sent"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      if (res.matched) {
        setMatch(res.match);
        qc.invalidateQueries({ queryKey: ["matches"] });
      }
    } catch (e) {
      notice(errMsg(e));
    }
  };

  const act = async (profile, action, reaction = null) => {
    setSheet(null);
    if (action === "pass") {
      remove(profile.id);
      try {
        await api.post("/swipe", { target_id: profile.id, action });
      } catch (e) {
        notice(errMsg(e));
      }
      return;
    }
    await follow(profile, action, reaction);
  };

  const doBlock = async () => {
    if (!blockTarget) return;
    setBusy(true);
    try {
      await api.post(`/users/${blockTarget.id}/block`);
      remove(blockTarget.id);
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["likes"] });
      qc.invalidateQueries({ queryKey: ["explore-topics"] });
      setBlockTarget(null);
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const doReport = async (reason, details) => {
    if (!reportTarget) return false;
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

  const openTopic = (t) => setTopic(t);

  const suggested = showAllSuggested ? list.slice(0, 12) : list.slice(0, 3);

  const renderPeopleList = (rows, subOf, emptyTitle, emptyText, testId) =>
    people.isLoading ? (
      <SoftCard className="px-5 py-2">
        <RowSkeleton rows={5} />
      </SoftCard>
    ) : people.isError ? (
      <SoftCard className="px-5 py-8 text-center" testId="error-alert">
        <p className="text-[18px] font-bold text-ink">Couldn't load people</p>
        <p className="mt-1 text-[15px] text-mute">Check your connection and try again.</p>
        <SoftPill className="mt-5" onClick={() => people.refetch()} testId="explore-retry-button">
          Try again
        </SoftPill>
      </SoftCard>
    ) : rows.length === 0 ? (
      <SoftCard className="px-5 py-8 text-center" testId={`${testId}-empty`}>
        <p className="text-[18px] font-bold text-ink">{emptyTitle}</p>
        <p className="mt-1 text-[15px] text-mute">{emptyText}</p>
        <SoftPill className="mt-5" onClick={() => navigate("/filters")} testId="explore-adjust-filters-button">
          Adjust filters
        </SoftPill>
      </SoftCard>
    ) : (
      <SoftCard className="px-5 py-1" testId={testId}>
        {rows.map((p, i) => (
          <PersonRow key={p.id} p={p} sub={subOf(p)} onOpen={setSheet} onFollow={follow} followed={followed.has(p.id)} last={i === rows.length - 1} />
        ))}
      </SoftCard>
    );

  return (
    <div className="vo-neu-page flex min-h-full flex-col" style={{ paddingBottom: NAV_PAD }} data-testid="explore-page">
      <header className="shrink-0 px-[clamp(14px,5cqi,20px)] pt-1">
        <SoftHeader
          right={
            <>
              <SoftIconButton icon={Search} label="Search" onClick={() => searchRef.current?.focus()} testId="explore-search-button" />
              <SoftIconButton icon={SlidersHorizontal} label="Filters" onClick={() => navigate("/filters")} testId="explore-filters-button" />
            </>
          }
        />
        <SoftTitle title="Explore" subtitle="Find people, interests, and communities" testId="explore-title" />
        <div className="mt-4">
          <SoftSearch inputRef={searchRef} value={q} onChange={setQ} onClear={() => setQ("")} placeholder="Search people, interests, or communities" testId="explore-search-input" />
        </div>
        {!s && <GlassSegmented options={TABS} value={tab} onChange={setTab} testIdPrefix="explore-tab" className="mt-4" />}
      </header>

      <div className="mt-4 flex flex-col gap-4 px-[clamp(14px,5cqi,20px)]">
        {s ? (
          <>
            {searchTopics.length > 0 && (
              <SoftCard className="p-4" testId="explore-search-topics">
                <SectionHead title="Communities" />
                <div className="mt-3.5 grid grid-cols-2 gap-3">
                  {searchTopics.slice(0, 6).map((t) => (
                    <TopicTile key={t.name} topic={t} onOpen={openTopic} className="aspect-[1.55/1]" />
                  ))}
                </div>
              </SoftCard>
            )}
            {searching && searchPeople.length === 0 ? (
              <SoftCard className="px-5 py-2">
                <RowSkeleton />
              </SoftCard>
            ) : searchPeople.length > 0 ? (
              <SoftCard className="px-5 pt-4 pb-1" testId="explore-search-people">
                <SectionHead title="People" />
                {searchPeople.map((p, i) => (
                  <PersonRow
                    key={p.id}
                    p={p}
                    sub={`@${p.username || "-"}${p.job ? ` · ${p.job}` : ""}`}
                    onOpen={(pp) => (pp.is_me ? navigate("/profile") : setSheet(pp))}
                    onFollow={follow}
                    followed={followed.has(p.id) || p.followed || p.matched}
                    followedLabel={p.matched ? "Matched" : "Following"}
                    isMe={p.is_me}
                    last={i === searchPeople.length - 1}
                    testId="explore-search-row"
                  />
                ))}
              </SoftCard>
            ) : !searching && searchTopics.length === 0 ? (
              <p className="pt-6 text-center text-[16px] text-mute" data-testid="explore-no-results">
                No results for "{q.trim()}".
              </p>
            ) : null}
          </>
        ) : tab === "people" ? (
          <>
            {/* Trending now */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween(D.base)}>
              <SoftCard className="p-4" testId="explore-trending">
                <SectionHead title="Trending now" action="See all" onAction={() => setTab("topics")} actionTestId="explore-trending-see-all" />
                <div className="mt-3.5 grid grid-cols-2 gap-3">
                  {topics.isLoading
                    ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[1.55/1] rounded-[18px]" />)
                    : (topics.data?.trending || []).map((t) => <TopicTile key={t.name} topic={t} onOpen={openTopic} className="aspect-[1.55/1]" />)}
                </div>
              </SoftCard>
            </motion.div>

            {/* Suggested for you */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween(D.base, 0.05)}>
              <SoftCard className="px-5 pt-4 pb-1" testId="explore-suggested">
                <SectionHead title="Suggested for you" action={list.length > 3 ? (showAllSuggested ? "Show less" : "See all") : null} onAction={() => setShowAllSuggested((v) => !v)} actionTestId="explore-suggested-see-all" />
                {people.isLoading ? (
                  <RowSkeleton />
                ) : suggested.length === 0 ? (
                  <p className="py-6 text-center text-[15px] text-mute" data-testid="explore-suggested-empty">
                    No suggestions right now. Try widening your filters.
                  </p>
                ) : (
                  suggested.map((p, i) => <PersonRow key={p.id} p={p} sub={whatTheyDo(p)} onOpen={setSheet} onFollow={follow} followed={followed.has(p.id)} last={i === suggested.length - 1} />)
                )}
              </SoftCard>
            </motion.div>

            {/* Popular interests */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween(D.base, 0.1)} data-testid="explore-popular">
              <SectionHead title="Popular interests" action="See all" onAction={() => setTab("topics")} actionTestId="explore-popular-see-all" />
              <div className="no-scrollbar -mx-[clamp(14px,5cqi,20px)] -mb-7 -mt-1 flex gap-3 overflow-x-auto px-[clamp(14px,5cqi,20px)] pb-7 pt-4 pr-8">
                {topics.isLoading
                  ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[44px] w-24 shrink-0 rounded-full" />)
                  : (topics.data?.popular || []).map((t) => (
                      <SoftPill key={t.name} onClick={() => openTopic(t)} className="h-[44px] px-5 text-[16px] font-medium" testId="explore-popular-chip">
                        {t.name}
                      </SoftPill>
                    ))}
              </div>
            </motion.div>
          </>
        ) : tab === "topics" ? (
          <SoftCard className="p-4" testId="explore-topics-grid">
            <SectionHead title="All communities" />
            <div className="mt-3.5 grid grid-cols-2 gap-3">
              {topics.isLoading
                ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-[1.55/1] rounded-[18px]" />)
                : (topics.data?.topics || []).map((t) => <TopicTile key={t.name} topic={t} onOpen={openTopic} className="aspect-[1.55/1]" />)}
            </div>
          </SoftCard>
        ) : tab === "nearby" ? (
          renderPeopleList(list, (p) => kmLabel(p.distance_km, p.city) || whatTheyDo(p), "No one nearby yet", user?.city ? "Widen your distance to see more people." : "Add your location in Edit Profile to see people near you.", "explore-nearby-list")
        ) : (
          renderPeopleList(list, (p) => `${whatTheyDo(p)}${p.likes_count ? ` · ${p.likes_count} likes` : ""}`, "No creators yet", "Popular people will show up here.", "explore-creators-list")
        )}
      </div>

      {/* Community members */}
      <Drawer open={!!topic} onOpenChange={(o) => !o && setTopic(null)}>
        <DrawerContent className="mx-auto max-h-[86dvh] max-w-[430px] rounded-t-[28px] border-0 bg-canvas" data-testid="topic-drawer">
          {topic && (
            <>
              <div className="relative mx-4 mt-3 h-[140px] overflow-hidden rounded-[22px] bg-surface2">
                {topic.cover && <img src={topic.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                <span className="vo-tile-fade absolute inset-x-0 bottom-0 h-[75%]" />
                <span className="absolute inset-x-5 bottom-4 text-white">
                  <DrawerTitle className="text-[28px] font-bold leading-[32px] tracking-[-0.02em] text-white">{topic.name}</DrawerTitle>
                  <DrawerDescription className="text-[15px] text-white/90" data-testid="topic-members">
                    {topicPeople.data?.members_label || topic.members_label}
                  </DrawerDescription>
                </span>
              </div>
              <div className="vo-scroll px-5 pb-8 pt-2">
                {topicPeople.isLoading ? (
                  <RowSkeleton rows={4} />
                ) : (topicPeople.data?.profiles || []).filter((p) => !gone.has(p.id)).length === 0 ? (
                  <p className="py-10 text-center text-[16px] text-mute" data-testid="topic-empty">
                    No one you can follow here yet.
                  </p>
                ) : (
                  topicPeople.data.profiles
                    .filter((p) => !gone.has(p.id))
                    .map((p, i, arr) => (
                      <PersonRow
                        key={p.id}
                        p={p}
                        sub={whatTheyDo(p)}
                        onOpen={(pp) => {
                          setTopic(null);
                          setTimeout(() => setSheet(pp), 200);
                        }}
                        onFollow={follow}
                        followed={followed.has(p.id)}
                        last={i === arr.length - 1}
                        testId="topic-person-row"
                      />
                    ))
                )}
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

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
              <button type="button" className="vo-action h-14 w-14" onClick={() => act(sheet, "superlike")} aria-label="Super Like" data-testid="sheet-superlike-button">
                <Star className="h-6 w-6" strokeWidth={2.2} />
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
