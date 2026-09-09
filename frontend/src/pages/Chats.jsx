import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMatchesQuery } from "@/hooks/useBadges";
import { UserPhoto } from "@/components/UserPhoto";
import { PageHeader, EmptyState, Skeleton } from "@/components/EmptyState";
import { timeAgo } from "@/lib/format";

export default function Chats() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useMatchesQuery();
  const matches = data?.matches || [];
  const fresh = matches.filter((m) => !m.last_message);
  const convos = matches.filter((m) => m.last_message);

  return (
    <div className="min-h-full pb-28" data-testid="chats-page">
      <PageHeader title="Chats" subtitle={matches.length ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}` : "Your matches and conversations live here."} />

      {isLoading ? (
        <div className="space-y-3 px-4 pt-2">
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[76px] w-[76px] rounded-full" />
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-[20px]" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={MessageCircle}
          title="Couldn't load chats"
          description="Check your connection and try again."
          testId="error-alert"
          action={
            <button type="button" className="vo-btn-primary" onClick={() => refetch()}>
              Try again
            </button>
          }
        />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No matches yet"
          description="When you and someone like each other, you'll be able to chat here. Go make it happen."
          action={
            <button type="button" className="vo-btn-primary" onClick={() => navigate("/discover")} data-testid="chats-go-discover-button">
              Start swiping
            </button>
          }
        />
      ) : (
        <>
          {fresh.length > 0 && (
            <section className="pt-1">
              <div className="vo-label px-5 pb-3">New matches</div>
              <div className="no-scrollbar flex gap-4 overflow-x-auto px-5 pb-2" data-testid="chats-new-matches">
                {fresh.map((m, i) => (
                  <motion.button
                    key={m.id}
                    type="button"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => navigate(`/chats/${m.id}`)}
                    className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 active:scale-95"
                    data-testid="chats-new-match-tile"
                  >
                    <span className="relative rounded-full p-[3px] ring-2 ring-brand">
                      <UserPhoto src={m.user.photos?.[0]} name={m.user.name} className="h-[66px] w-[66px] rounded-full text-xl" />
                      {m.superlike && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-voila text-white ring-2 ring-white">
                          <Zap className="h-3.5 w-3.5 fill-white" />
                        </span>
                      )}
                      {m.online && <span className="vo-dot-online" />}
                    </span>
                    <span className="w-full truncate text-center text-[13px] font-semibold text-ink">{m.user.name}</span>
                  </motion.button>
                ))}
              </div>
            </section>
          )}

          <section className="pt-4">
            <div className="vo-label px-5 pb-2">Messages</div>
            {convos.length === 0 ? (
              <p className="px-5 pt-3 text-[14px] text-mute" data-testid="chats-no-conversations">
                No conversations yet. Tap a new match above and break the ice.
              </p>
            ) : (
              <ul className="px-3" data-testid="chats-list">
                {convos.map((m, i) => {
                  const mine = m.last_message?.sender_id === user?.id;
                  return (
                    <motion.li key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <button type="button" onClick={() => navigate(`/chats/${m.id}`)} className="vo-row" data-testid="chats-list-row">
                        <span className="relative shrink-0">
                          <UserPhoto src={m.user.photos?.[0]} name={m.user.name} className="h-14 w-14 rounded-full text-lg" />
                          {m.online && <span className="vo-dot-online" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[16px] font-semibold text-ink">{m.user.name}</span>
                            <span className="shrink-0 text-[12px] text-mute">{timeAgo(m.last_message_at)}</span>
                          </span>
                          <span className="mt-0.5 flex items-center justify-between gap-2">
                            <span className={`truncate text-[14px] ${m.unread ? "font-semibold text-ink" : "text-mute"}`}>
                              {mine ? "You: " : ""}
                              {m.last_message?.text}
                            </span>
                            {m.unread > 0 && <span className="vo-badge shrink-0" data-testid="chats-unread-badge">{m.unread}</span>}
                          </span>
                        </span>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
