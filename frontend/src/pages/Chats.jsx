import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Search, SquarePen, X, Image as ImageIcon, Film, ChevronRight, CheckCheck } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useMatchesQuery } from "@/hooks/useBadges";
import { UserPhoto } from "@/components/UserPhoto";
import { SkeletonList } from "@/components/EmptyState";
import { GlassSegmented } from "@/components/GlassSegmented";
import { SoftIconButton, SoftEmpty, BubblesArt } from "@/components/SoftUI";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { chatTime } from "@/lib/format";
import { tween, D } from "@/lib/motion";

/*
 * Messages inbox. "All" = matches + conversations you started; "Requests" = people who messaged you first
 * (Instagram DM requests) - they stay there until you reply or accept; "Unread" = anything waiting for you.
 */

const NAV_PAD = "calc(var(--nav-h) + var(--nav-gap) + 14px + var(--safe-bottom))";

export default function Chats() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useMatchesQuery();
  const [tab, setTab] = useState("all");
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [compose, setCompose] = useState(false);
  const searchRef = useRef(null);
  const { subscribe } = useSocket();
  const [typing, setTypingMap] = useState({}); // match_id -> true while the other person is typing
  const typingTimers = useRef({});
  const matches = useMemo(() => data?.matches || [], [data]);

  // live "typing..." in the list (same event the room uses)
  useEffect(
    () =>
      subscribe((ev) => {
        if (ev.type !== "typing" || !ev.match_id) return;
        setTypingMap((t) => ({ ...t, [ev.match_id]: true }));
        clearTimeout(typingTimers.current[ev.match_id]);
        typingTimers.current[ev.match_id] = setTimeout(() => setTypingMap((t) => ({ ...t, [ev.match_id]: false })), 2500);
      }),
    [subscribe]
  );
  const requests = useMemo(() => data?.requests || [], [data]);

  const TABS = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "requests", label: requests.length ? `Requests (${requests.length})` : "Requests" },
      { value: "unread", label: "Unread" },
    ],
    [requests.length]
  );

  useEffect(() => {
    if (searching) searchRef.current?.focus();
    else setQ("");
  }, [searching]);

  const filtered = useMemo(() => {
    if (tab === "requests") return requests;
    if (tab === "unread") return matches.filter((m) => m.unread > 0);
    return matches;
  }, [matches, requests, tab]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? filtered.filter((m) => m.user.name.toLowerCase().includes(s) || (m.user.username || "").toLowerCase().includes(s)) : filtered;
  }, [filtered, q]);

  const preview = (m) => {
    if (typing[m.id])
      return (
        <span className="inline-flex items-center gap-2" data-testid="chats-typing">
          <span className="vo-inbox-typing" aria-hidden="true">
            <i /><i /><i />
          </span>
          typing...
        </span>
      );
    if (m.is_request) return m.last_message?.text ? m.last_message.text : "Wants to send you a message";
    if (!m.last_message) {
      if (m.kind === "dm" && m.status === "request") return "Request sent";
      return "New match. Say hi!";
    }
    const mine = m.last_message.sender_id === user?.id;
    if (m.last_message.kind === "image" || m.last_message.kind === "video") {
      const Icon = m.last_message.kind === "video" ? Film : ImageIcon;
      return (
        <>
          {mine ? "You: " : ""}
          <Icon className="mr-1 inline h-[15px] w-[15px] -translate-y-px" strokeWidth={2} />
          {m.last_message.text || (m.last_message.kind === "video" ? "Video" : "Photo")}
        </>
      );
    }
    if (m.last_message.kind === "reaction") return mine ? m.last_message.text.replace("Liked your", "You liked their") : m.last_message.text;
    if (m.kind === "dm" && m.status === "request" && mine) return `${m.last_message.text} · Request sent`;
    if (mine)
      return (
        <>
          <CheckCheck className={`mr-1.5 inline h-[16px] w-[16px] -translate-y-px ${m.last_read ? "text-blue" : "text-mute"}`} strokeWidth={2} data-testid={m.last_read ? "chats-read-ticks" : "chats-sent-ticks"} />
          {m.last_message.text}
        </>
      );
    return m.last_message.text;
  };

  const empty = {
    all: { title: "No conversations yet", description: "Match with someone, or open a profile and tap Message.", footer: "Start something new" },
    requests: { title: "No message requests", description: "When someone you haven't matched with messages you, it shows up here first.", footer: "You're in control" },
    unread: { title: "You're all caught up", description: "Unread messages will show up here.", footer: "Start something new" },
  }[tab];

  return (
    <div className={`vo-neu-page flex flex-col ${rows.length ? "min-h-full" : "h-full"}`} style={{ paddingBottom: NAV_PAD }} data-testid="chats-page">
      <header className="shrink-0 px-[clamp(14px,5cqi,20px)] pt-3">
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[clamp(32px,10cqi,40px)] font-bold leading-[1.1] tracking-[-0.03em] text-ink" data-testid="chats-title">
              Messages
            </h1>
            <p className="mt-1.5 text-[clamp(15px,4.6cqi,18px)] leading-[1.3] tracking-[-0.01em] text-mute">Your conversations</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <SoftIconButton icon={searching ? X : Search} label={searching ? "Close search" : "Search conversations"} active={searching} onClick={() => setSearching((v) => !v)} testId="chats-search-button" />
            <SoftIconButton icon={SquarePen} label="New message" onClick={() => setCompose(true)} testId="chats-compose-button" />
          </div>
        </div>
        <GlassSegmented options={TABS} value={tab} onChange={setTab} testIdPrefix="chats-tab" className="vo-seg-inbox mt-5 mb-1" />
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
        <ul className="vo-inbox mt-4 flex flex-col px-[clamp(14px,5cqi,20px)]" data-testid="chats-list">
          {tab === "requests" && (
            <li className="pb-2 text-[13px] leading-[17px] text-mute" data-testid="chats-requests-hint">
              These people aren't your matches yet. Open a request to accept or delete it - they won't know until you reply.
            </li>
          )}
          {rows.map((m, i) => (
            <motion.li key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween(D.base, Math.min(i, 8) * 0.03)} className="vo-inbox-item">
              <button type="button" onClick={() => navigate(`/chats/${m.id}`)} className="vo-inbox-row" data-testid={m.is_request ? "chats-request-row" : "chats-list-row"} data-kind={m.kind}>
                <span className="relative shrink-0">
                  <UserPhoto src={m.user.photos?.[0]} name={m.user.name} size="xs" className="h-[48px] w-[48px] rounded-full text-[18px]" />
                  {m.online && <span className="vo-dot-online" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[20px] font-semibold leading-[24px] tracking-[-0.02em] text-ink">
                    <span className="truncate">{m.user.name}</span>
                    {m.user.verified && <VerifiedBadge size={18} testId="chats-row-verified" />}
                  </span>
                  <span className={`mt-[3px] block truncate text-[16px] leading-[20px] tracking-[-0.005em] ${m.unread || m.is_request ? "font-medium text-ink" : "text-mute"}`} data-testid="chats-last-message">
                    {preview(m)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-[6px] self-start pt-[2px]">
                  <span className="text-[15px] leading-[18px] text-mute">{chatTime(m.last_message_at || m.created_at)}</span>
                  {m.is_request ? (
                    <span className="inline-flex h-[22px] items-center rounded-full bg-ink px-2.5 text-[11px] font-semibold text-onink" data-testid="chats-request-badge">
                      Request
                    </span>
                  ) : m.unread > 0 ? (
                    <span className="vo-inbox-badge" data-testid="chats-unread-badge">
                      {m.unread > 99 ? "99+" : m.unread}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="ml-[2px] h-[20px] w-[20px] shrink-0 text-mute/70" strokeWidth={2} aria-hidden="true" />
              </button>
            </motion.li>
          ))}
        </ul>
      )}

      <Drawer open={compose} onOpenChange={setCompose}>
        <DrawerContent className="mx-auto max-h-[80dvh] max-w-[430px] rounded-t-[28px] border-0 bg-canvas" data-testid="compose-drawer">
          <DrawerTitle className="mt-3 px-5 text-[22px] font-bold tracking-[-0.02em] text-ink">New message</DrawerTitle>
          <DrawerDescription className="mb-3 px-5 text-[15px] text-mute">Pick a conversation, or find someone new in Explore.</DrawerDescription>
          <div className="vo-scroll px-5 pb-8">
            {matches.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-mute">
                  <MessageCircle className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <p className="mt-3 text-[16px] font-semibold text-ink">No conversations yet</p>
                <p className="mt-1 text-[14px] text-mute">Open anyone's profile and tap Message.</p>
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
                <button
                  type="button"
                  className="vo-soft-row"
                  onClick={() => {
                    setCompose(false);
                    navigate("/explore");
                  }}
                  data-testid="compose-find-people-row"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-onink">
                    <Search className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <span className="text-[16px] font-semibold text-ink">Find someone new</span>
                </button>
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
                    <UserPhoto src={m.user.photos?.[0]} name={m.user.name} size="xs" className="h-11 w-11 rounded-full text-sm" />
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
