import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Search, SquarePen, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useAuth } from "@/context/AuthContext";
import { useMatchesQuery } from "@/hooks/useBadges";
import { UserPhoto } from "@/components/UserPhoto";
import { SkeletonList } from "@/components/EmptyState";
import { GlassSegmented } from "@/components/GlassSegmented";
import { SoftHeader, SoftIconButton, SoftTitle, SoftEmpty, BubblesArt } from "@/components/SoftUI";
import { chatTime } from "@/lib/format";
import { tween, D } from "@/lib/motion";

const TABS = [
  { value: "all", label: "All" },
  { value: "matches", label: "Matches" },
  { value: "unread", label: "Unread" },
];

const NAV_PAD = "calc(var(--nav-h) + var(--nav-gap) + 14px + env(safe-area-inset-bottom, 0px))";

export default function Chats() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useMatchesQuery();
  const [tab, setTab] = useState("all");
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [compose, setCompose] = useState(false);
  const searchRef = useRef(null);
  const matches = useMemo(() => data?.matches || [], [data]);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
    else setQ("");
  }, [searching]);

  const filtered = useMemo(() => {
    if (tab === "matches") return matches.filter((m) => !m.last_message);
    if (tab === "unread") return matches.filter((m) => m.unread > 0);
    return matches;
  }, [matches, tab]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? filtered.filter((m) => m.user.name.toLowerCase().includes(s)) : filtered;
  }, [filtered, q]);

  const preview = (m) => {
    if (!m.last_message) return "New match. Say hi!";
    const mine = m.last_message.sender_id === user?.id;
    if (m.last_message.kind === "reaction") return mine ? m.last_message.text.replace("Liked your", "You liked their") : m.last_message.text;
    return `${mine ? "You: " : ""}${m.last_message.text}`;
  };

  const empty = {
    all: { title: "No conversations yet", description: "When you match, you can start a conversation here.", footer: "Start something new" },
    matches: { title: "No new matches", description: "Matches you haven't messaged yet will show up here.", footer: "Start something new" },
    unread: { title: "You're all caught up", description: "Unread messages will show up here.", footer: "Start something new" },
  }[tab];

  return (
    <div className={`vo-neu-page flex flex-col ${rows.length ? "min-h-full" : "h-full"}`} style={{ paddingBottom: NAV_PAD }} data-testid="chats-page">
      <header className="shrink-0 px-5 pt-1">
        <SoftHeader
          right={
            <>
              <SoftIconButton icon={searching ? X : Search} label={searching ? "Close search" : "Search conversations"} active={searching} onClick={() => setSearching((v) => !v)} testId="chats-search-button" />
              <SoftIconButton icon={SquarePen} label="New message" onClick={() => setCompose(true)} testId="chats-compose-button" />
            </>
          }
        />
        <SoftTitle title="Messages" subtitle="Your conversations" testId="chats-title" />
        <GlassSegmented options={TABS} value={tab} onChange={setTab} testIdPrefix="chats-tab" className="mt-4" />
        {searching && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={tween(D.base)} className="vo-soft relative mt-3 flex h-[48px] items-center rounded-full">
            <Search className="pointer-events-none absolute left-4 h-5 w-5 text-mute" strokeWidth={2} />
            <input ref={searchRef} className="h-full w-full rounded-full bg-transparent pl-12 pr-4 text-[16px] text-ink outline-none placeholder:text-mute" placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} data-testid="chats-search-input" />
          </motion.div>
        )}
      </header>

      {isLoading ? (
        <SkeletonList rows={6} avatar={56} className="mt-5 px-5" />
      ) : isError ? (
        <SoftEmpty art={<BubblesArt />} title="Couldn't load chats" description="Check your connection and try again." actionLabel="Try again" onAction={() => refetch()} actionTestId="chats-retry-button" testId="error-alert" />
      ) : rows.length === 0 ? (
        q ? (
          <p className="px-5 pt-8 text-center text-[16px] text-mute" data-testid="chats-no-results">
            No conversations match "{q}".
          </p>
        ) : (
          <SoftEmpty art={<BubblesArt />} title={empty.title} description={empty.description} actionIcon={Search} actionLabel="Find people" onAction={() => navigate("/explore")} actionTestId="chats-find-people-button" footer={empty.footer} />
        )
      ) : (
        <ul className="mt-5 flex flex-col gap-3 px-5" data-testid="chats-list">
          {rows.map((m, i) => (
            <motion.li key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween(D.base, Math.min(i, 8) * 0.03)}>
              <button type="button" onClick={() => navigate(`/chats/${m.id}`)} className="vo-soft-row" data-testid="chats-list-row">
                <span className="relative shrink-0">
                  <UserPhoto src={m.user.photos?.[0]} name={m.user.name} className="h-[56px] w-[56px] rounded-full text-xl" />
                  {m.online && <span className="vo-dot-online" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">{m.user.name}</span>
                  <span className={`mt-0.5 block truncate text-[15px] ${m.unread ? "font-medium text-ink" : "text-mute"}`} data-testid="chats-last-message">
                    {preview(m)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5 pr-1">
                  <span className="text-[13px] text-mute">{chatTime(m.last_message_at || m.created_at)}</span>
                  {m.unread > 0 && (
                    <span className="vo-badge" data-testid="chats-unread-badge">
                      {m.unread}
                    </span>
                  )}
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}

      <Drawer open={compose} onOpenChange={setCompose}>
        <DrawerContent className="mx-auto max-h-[80dvh] max-w-[430px] rounded-t-[28px] border-0 bg-canvas" data-testid="compose-drawer">
          <DrawerTitle className="mt-3 px-5 text-[22px] font-bold tracking-[-0.02em] text-ink">New message</DrawerTitle>
          <DrawerDescription className="mb-3 px-5 text-[15px] text-mute">Pick a match to start talking.</DrawerDescription>
          <div className="vo-scroll px-5 pb-8">
            {matches.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-mute">
                  <MessageCircle className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <p className="mt-3 text-[16px] font-semibold text-ink">No matches yet</p>
                <p className="mt-1 text-[14px] text-mute">Find people in Explore to get started.</p>
                <button
                  type="button"
                  className="vo-soft-btn mt-5 h-12 max-w-[240px] text-[16px]"
                  onClick={() => {
                    setCompose(false);
                    navigate("/explore");
                  }}
                  data-testid="compose-find-people-button"
                >
                  <Search className="h-5 w-5" strokeWidth={2.2} /> Find people
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="vo-soft-row"
                    onClick={() => {
                      setCompose(false);
                      navigate(`/chats/${m.id}`);
                    }}
                    data-testid="compose-match-row"
                  >
                    <UserPhoto src={m.user.photos?.[0]} name={m.user.name} className="h-11 w-11 rounded-full text-sm" />
                    <span className="text-[16px] font-semibold text-ink">{m.user.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
