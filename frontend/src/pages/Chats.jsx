import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Search, SquarePen } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useAuth } from "@/context/AuthContext";
import { useMatchesQuery } from "@/hooks/useBadges";
import { Brand } from "@/components/Logo";
import { UserPhoto } from "@/components/UserPhoto";
import { EmptyState, SkeletonList } from "@/components/EmptyState";
import { chatTime } from "@/lib/format";
import { tween, D } from "@/lib/motion";

export default function Chats() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useMatchesQuery();
  const [q, setQ] = useState("");
  const [compose, setCompose] = useState(false);
  const matches = useMemo(() => data?.matches || [], [data]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? matches.filter((m) => m.user.name.toLowerCase().includes(s)) : matches;
  }, [matches, q]);

  const preview = (m) => {
    if (!m.last_message) return "New match. Say hi!";
    const mine = m.last_message.sender_id === user?.id;
    if (m.last_message.kind === "reaction") return mine ? m.last_message.text.replace("Liked your", "You liked their") : m.last_message.text;
    return `${mine ? "You: " : ""}${m.last_message.text}`;
  };

  return (
    <div className="min-h-full pb-24" data-testid="chats-page">
      <header className="px-4 pt-1">
        <div className="flex h-14 items-center">
          <Brand size={30} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="vo-title">Chat</h1>
          <button type="button" className="vo-icon-plain text-ink" onClick={() => setCompose(true)} aria-label="New message" data-testid="chats-compose-button">
            <SquarePen className="h-6 w-6" strokeWidth={1.9} />
          </button>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mute" strokeWidth={2} />
          <input className="vo-input pl-12 text-[16px]" style={{ height: 48 }} placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} data-testid="chats-search-input" />
        </div>
      </header>

      {isLoading ? (
        <SkeletonList rows={6} avatar={60} className="mt-1 px-4" />
      ) : isError ? (
        <EmptyState
          icon={MessageCircle}
          title="Couldn't load chats"
          description="Check your connection and try again."
          testId="error-alert"
          action={
            <button type="button" className="vo-btn-primary w-full" onClick={() => refetch()}>
              Try again
            </button>
          }
        />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No matches yet"
          description="When you and someone like each other, you'll be able to talk here."
          action={
            <button type="button" className="vo-btn-primary w-full" onClick={() => navigate("/discover")} data-testid="chats-go-discover-button">
              Start swiping
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <p className="px-4 pt-6 text-center text-[14px] text-mute" data-testid="chats-no-results">
          No conversations match "{q}".
        </p>
      ) : (
        <ul className="mt-1 px-4" data-testid="chats-list">
          {rows.map((m, i) => (
            <motion.li key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tween(D.base, Math.min(i, 8) * 0.03)} className="border-b border-line">
              <button type="button" onClick={() => navigate(`/chats/${m.id}`)} className="flex w-full items-center gap-3.5 py-3 text-left active:opacity-70" data-testid="chats-list-row">
                <span className="relative shrink-0">
                  <UserPhoto src={m.user.photos?.[0]} name={m.user.name} className="h-[60px] w-[60px] rounded-full text-xl" />
                  {m.online && <span className="vo-dot-online" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[18px] font-semibold tracking-[-0.01em] text-ink">{m.user.name}</span>
                  <span className={`mt-0.5 block truncate text-[15px] ${m.unread ? "font-medium text-ink" : "text-mute"}`} data-testid="chats-last-message">
                    {preview(m)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[14px] text-mute">{chatTime(m.last_message_at || m.created_at)}</span>
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
        <DrawerContent className="mx-auto max-h-[80dvh] max-w-[430px] rounded-t-[20px] border-0 bg-bg" data-testid="compose-drawer">
          <DrawerTitle className="mt-3 px-5 text-[18px] font-bold text-ink">New message</DrawerTitle>
          <DrawerDescription className="mb-2 px-5 text-[13px] text-mute">Pick a match to start talking.</DrawerDescription>
          <div className="vo-scroll px-5 pb-8">
            {matches.length === 0 ? (
              <p className="py-6 text-center text-[14px] text-mute">No matches yet.</p>
            ) : (
              matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-line py-3 text-left"
                  onClick={() => {
                    setCompose(false);
                    navigate(`/chats/${m.id}`);
                  }}
                  data-testid="compose-match-row"
                >
                  <UserPhoto src={m.user.photos?.[0]} name={m.user.name} className="h-11 w-11 rounded-full text-sm" />
                  <span className="text-[15px] font-semibold text-ink">{m.user.name}</span>
                </button>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
