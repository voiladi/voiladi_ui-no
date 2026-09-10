import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Heart, Star, MessageCircle, Users, Bell, ShieldCheck, Settings, BadgeCheck, ShieldAlert } from "lucide-react";
import { useNotifications, markNotificationsSeen } from "@/hooks/useNotifications";
import { UserPhoto } from "@/components/UserPhoto";
import { Segmented } from "@/components/Chip";
import { SkeletonList } from "@/components/Loading";
import { agoLabel } from "@/lib/format";

const TABS = ["all", "likes", "matches", "messages", "system"];
const TAB_LABEL = { all: "All", likes: "Likes", matches: "Matches", messages: "Messages", system: "System" };
const TAB_TYPES = { likes: ["like", "superlike"], matches: ["match"], messages: ["message"], system: ["system"] };

/* Avatar badge per type: pink heart (like), purple star (super like), green bubble (message), blue people (match). */
const BADGE = {
  like: { bg: "#FF4D8D", Icon: Heart },
  superlike: { bg: "#7C5CFF", Icon: Star },
  message: { bg: "#22C55E", Icon: MessageCircle },
  match: { bg: "#3478F6", Icon: Users },
};

const SYSTEM_ICON = { bell: Bell, shield: ShieldCheck, gear: Settings, "badge-check": BadgeCheck, "shield-alert": ShieldAlert };

const Avatar = ({ item }) => {
  if (item.type === "system" || item.type === "verification") {
    if (item.icon === "logo") {
      return (
        <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-ink" aria-hidden="true">
          <svg viewBox="0 0 100 100" width="34" height="34" fill="none">
            <line x1="71" y1="30" x2="55" y2="64" stroke="#C8CACE" strokeWidth="13" strokeLinecap="round" />
            <line x1="29.5" y1="30" x2="48" y2="72" stroke="#FFFFFF" strokeWidth="16" strokeLinecap="round" />
          </svg>
        </span>
      );
    }
    const Icon = SYSTEM_ICON[item.icon] || Bell;
    return (
      <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-surface text-ink" aria-hidden="true">
        <Icon className="h-[26px] w-[26px]" strokeWidth={1.8} />
      </span>
    );
  }
  const b = BADGE[item.type] || BADGE.like;
  return (
    <span className="relative shrink-0">
      <UserPhoto src={item.user?.photos?.[0]} name={item.user?.name} className="h-[60px] w-[60px] rounded-full text-xl" />
      <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full text-white ring-[3px] ring-bg" style={{ background: b.bg }}>
        <b.Icon className="h-[13px] w-[13px]" fill="currentColor" strokeWidth={2} />
      </span>
    </span>
  );
};

const Row = ({ item, onClick }) => (
  <button type="button" onClick={onClick} className="vo-nrow" data-testid="notification-row" data-type={item.type}>
    <Avatar item={item} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[16px] font-semibold leading-[22px] tracking-[-0.015em] text-ink" data-testid="notification-title">
        {item.title}
      </span>
      <span className="mt-0.5 block truncate text-[14px] leading-[19px] tracking-[-0.01em] text-mute">{item.sub}</span>
    </span>
    <span className="flex shrink-0 items-center gap-1.5 self-start pt-0.5">
      <span className="whitespace-nowrap text-[14px] leading-[22px] text-mute" data-testid="notification-time">
        {agoLabel(item.created_at)}
      </span>
      <ChevronRight className="h-4 w-4 text-mute" strokeWidth={2.2} />
    </span>
  </button>
);

const Group = ({ label, items, onOpen }) =>
  items.length ? (
    <section className="mt-5" data-testid={`notifications-group-${label.toLowerCase()}`}>
      <h2 className="px-1 text-[17px] font-semibold text-ink2">{label}</h2>
      <div className="vo-pcard mt-3 overflow-hidden">
        {items.map((it) => (
          <Row key={it.id} item={it} onClick={() => onOpen(it)} />
        ))}
      </div>
    </section>
  ) : null;

export default function Notifications() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const { data, isLoading, isError, refetch } = useNotifications(true);
  const seenAtRef = useRef(null);

  // remember the split point from the first load, then mark everything as seen (drops the bell dot)
  useEffect(() => {
    if (!data || seenAtRef.current) return;
    seenAtRef.current = data.seen_at;
    markNotificationsSeen(qc);
  }, [data, qc]);

  const { fresh, earlier } = useMemo(() => {
    const items = (data?.items || []).filter((i) => tab === "all" || TAB_TYPES[tab].includes(i.type));
    const cut = seenAtRef.current || data?.seen_at || "";
    return { fresh: items.filter((i) => i.created_at > cut), earlier: items.filter((i) => i.created_at <= cut) };
  }, [data, tab]);

  const open = (item) => navigate(item.href || "/likes");

  return (
    <div className="min-h-full bg-canvas px-3 pb-8" data-testid="notifications-page">
      <header className="flex h-14 items-center gap-3 pt-1">
        <button type="button" className="-ml-1 flex h-10 w-10 items-center justify-center text-ink active:opacity-60" onClick={() => navigate(-1)} aria-label="Back" data-testid="notifications-back-button">
          <ChevronLeft className="h-7 w-7" strokeWidth={2.4} />
        </button>
        <h1 className="text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">Notifications</h1>
      </header>

      <Segmented options={TABS} value={tab} onChange={setTab} render={(k) => TAB_LABEL[k]} testIdPrefix="notifications-tab" fit className="mt-3 vo-seg-lg" />

      {isLoading ? (
        <div className="vo-pcard mt-6 px-3">
          <SkeletonList rows={5} avatar={60} />
        </div>
      ) : isError ? (
        <div className="mt-16 flex flex-col items-center text-center" data-testid="notifications-error">
          <p className="text-[17px] font-semibold text-ink">Couldn't load notifications</p>
          <button type="button" className="vo-btn-primary mt-4 px-6" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : fresh.length + earlier.length === 0 ? (
        <div className="mt-20 flex flex-col items-center text-center" data-testid="notifications-empty">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-surface text-ink">
            <Bell className="h-8 w-8" strokeWidth={1.6} />
          </span>
          <p className="mt-4 text-[17px] font-semibold text-ink">You're all caught up</p>
          <p className="mt-1 text-[15px] text-mute">New likes, matches and messages will show up here.</p>
        </div>
      ) : (
        <>
          <Group label="New" items={fresh} onOpen={open} />
          <Group label="Earlier" items={earlier} onOpen={open} />
        </>
      )}
    </div>
  );
}
