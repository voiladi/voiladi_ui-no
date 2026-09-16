import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, CheckCheck, Heart, Star, MessageCircle, Bell, BadgeCheck, ShieldAlert, AtSign } from "lucide-react";
import { useNotifications, markNotificationsSeen, markNotificationsRead } from "@/hooks/useNotifications";
import { UserPhoto } from "@/components/UserPhoto";
import { ProfileSheet } from "@/components/ProfileSheet";
import { GlassSegmented } from "@/components/GlassSegmented";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { SkeletonList } from "@/components/Loading";
import { timeAgo } from "@/lib/format";
import { api, errMsg } from "@/lib/api";
import { notice } from "@/lib/feedback";

/*
 * Notifications - Instagram / Facebook style.
 *  Tabs (pill segmented control as in the owner's reference): All · Requests · Unread
 *  Sections by time (Today / Yesterday / This week / This month / Earlier); unread rows are tinted with a blue dot,
 *  message requests carry inline Accept / Delete. Tapping a row marks it read and opens the target.
 */
const TABS = [
  { value: "all", label: "All" },
  { value: "requests", label: "Requests" },
  { value: "unread", label: "Unread" },
];

const BADGE = {
  like: { bg: "#FF3B5C", Icon: Heart },
  superlike: { bg: "#7C5CFF", Icon: Star },
  request: { bg: "#22C55E", Icon: MessageCircle },
  message: { bg: "#22C55E", Icon: MessageCircle },
  tag: { bg: "#3478F6", Icon: AtSign },
};

const sectionOf = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  if (days < 30) return "This month";
  return "Earlier";
};
const SECTIONS = ["Today", "Yesterday", "This week", "This month", "Earlier"];

const Avatar = ({ item, onOpenProfile }) => {
  if (item.type === "verification") {
    const ok = item.icon !== "shield-alert";
    const Icon = ok ? BadgeCheck : ShieldAlert;
    return (
      <span className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full bg-ink text-onink" aria-hidden="true">
        <Icon className="h-[26px] w-[26px]" strokeWidth={1.9} />
      </span>
    );
  }
  const b = BADGE[item.type] || BADGE.like;
  return (
    <button type="button" className="relative shrink-0 focus-visible:outline-none active:opacity-80" onClick={onOpenProfile} aria-label={`Open ${item.user?.name || "profile"}`} data-testid="notification-avatar">
      <UserPhoto src={item.user?.photos?.[0]} name={item.user?.name} size="xs" className="h-[56px] w-[56px] rounded-full text-xl" />
      <span className="absolute -bottom-0.5 -right-0.5 flex h-[24px] w-[24px] items-center justify-center rounded-full text-white ring-[2.5px] ring-canvas" style={{ background: b.bg }}>
        <b.Icon className="h-[12px] w-[12px]" fill="currentColor" strokeWidth={2} />
      </span>
    </button>
  );
};

const Row = ({ item, onOpen, onOpenProfile, onAccept, onDelete, busy }) => {
  const pending = item.type === "request" && item.status === "pending";
  return (
    <div className={`vo-notif-row ${item.read ? "" : "vo-notif-unread"}`} data-testid="notification-row" data-type={item.type} data-read={item.read ? "true" : "false"}>
      <Avatar item={item} onOpenProfile={onOpenProfile} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline-none" data-testid="notification-open">
        <p className="text-[15.5px] leading-[21px] tracking-[-0.01em] text-ink" data-testid="notification-text">
          <span className="font-semibold" data-testid="notification-actor">
            {item.actor}
          </span>
          {item.user?.verified && <VerifiedBadge size={14} inline className="mx-1 inline-block -translate-y-px" />}
          {" "}
          {item.text}
          {" "}
          <span className="whitespace-nowrap text-mute" data-testid="notification-time">
            {timeAgo(item.created_at)}
          </span>
        </p>
        {pending && (
          <span className="mt-2.5 flex items-center gap-2" data-testid="notification-request-actions">
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onAccept();
              }}
              className="inline-flex h-[34px] items-center justify-center rounded-[10px] bg-blue px-5 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-50"
              data-testid="notification-accept"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="inline-flex h-[34px] items-center justify-center rounded-[10px] bg-surface2 px-5 text-[15px] font-semibold text-ink active:opacity-80 disabled:opacity-50"
              data-testid="notification-delete"
            >
              Delete
            </button>
          </span>
        )}
      </button>
      {!item.read && <span className="mt-[7px] h-[10px] w-[10px] shrink-0 self-start rounded-full bg-blue" aria-label="Unread" data-testid="notification-unread-dot" />}
    </div>
  );
};

const EMPTY = {
  all: { title: "You're all caught up", sub: "Likes, message requests and messages will show up here." },
  requests: { title: "No requests", sub: "When someone new sends you a message, it appears here for you to accept or delete." },
  unread: { title: "Nothing unread", sub: "You've seen everything. New activity will show up here." },
};

export default function Notifications() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [person, setPerson] = useState(null);
  const { data, isLoading, isError, refetch } = useNotifications(true);
  const seenOnce = useRef(false);

  // opening the page drops the bell dot; rows keep their own read state
  useEffect(() => {
    if (!data || seenOnce.current) return;
    seenOnce.current = true;
    markNotificationsSeen(qc);
  }, [data, qc]);

  const items = data?.items || [];
  const visible = useMemo(() => {
    if (tab === "requests") return items.filter((i) => i.type === "request" && i.status === "pending");
    if (tab === "unread") return items.filter((i) => !i.read);
    return items;
  }, [items, tab]);

  const sections = useMemo(() => {
    const map = {};
    visible.forEach((i) => {
      const s = sectionOf(i.created_at);
      (map[s] = map[s] || []).push(i);
    });
    return SECTIONS.filter((s) => map[s]).map((s) => ({ label: s, items: map[s] }));
  }, [visible]);

  const unread = data?.unread_count || 0;

  const open = (item) => {
    if (!item.read) markNotificationsRead(qc, [item.id]);
    navigate(item.href || "/likes");
  };

  const openProfile = async (item) => {
    if (!item.user?.id) return;
    try {
      const { data: profile } = await api.get(`/users/${item.user.id}`);
      setPerson(profile);
    } catch (e) {
      navigate(item.href || "/likes");
    }
  };

  const accept = async (item) => {
    setBusyId(item.id);
    try {
      await api.post(`/matches/${item.match_id}/accept`);
      qc.setQueryData(["notifications"], (old) =>
        old ? { ...old, request_count: Math.max(0, (old.request_count || 0) - 1), items: old.items.map((i) => (i.id === item.id ? { ...i, status: "accepted", read: true, text: "can now message you - you accepted their request." } : i)) } : old
      );
      qc.invalidateQueries({ queryKey: ["chats"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      notice(`You accepted ${item.actor.split(" ")[0]}'s request`);
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBusyId("");
    }
  };

  const remove = async (item) => {
    setBusyId(item.id);
    try {
      await api.delete(`/matches/${item.match_id}`);
      qc.setQueryData(["notifications"], (old) => (old ? { ...old, request_count: Math.max(0, (old.request_count || 0) - 1), items: old.items.filter((i) => i.id !== item.id && i.match_id !== item.match_id) } : old));
      qc.invalidateQueries({ queryKey: ["chats"] });
      notice("Request deleted");
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBusyId("");
    }
  };

  const empty = EMPTY[tab];

  return (
    <div className="min-h-full bg-canvas px-4 pb-10" data-testid="notifications-page">
      <header className="flex h-14 items-center gap-2 pt-1">
        <button type="button" className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center text-ink active:opacity-60" onClick={() => navigate(-1)} aria-label="Back" data-testid="notifications-back-button">
          <ChevronLeft className="h-7 w-7" strokeWidth={2.4} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">Notifications</h1>
        {unread > 0 && (
          <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink active:opacity-60" onClick={() => markNotificationsRead(qc, null, true)} aria-label="Mark all as read" title="Mark all as read" data-testid="notifications-mark-all-read">
            <CheckCheck className="h-[24px] w-[24px]" strokeWidth={2.1} />
          </button>
        )}
      </header>

      <GlassSegmented options={TABS} value={tab} onChange={setTab} testIdPrefix="notifications-tab" className="vo-seg-inbox mt-4 mb-1" />

      {isLoading ? (
        <div className="mt-6">
          <SkeletonList rows={6} avatar={56} />
        </div>
      ) : isError ? (
        <div className="mt-16 flex flex-col items-center text-center" data-testid="notifications-error">
          <p className="text-[17px] font-semibold text-ink">Couldn't load notifications</p>
          <button type="button" className="vo-btn-primary mt-4 px-6" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-24 flex flex-col items-center px-6 text-center" data-testid="notifications-empty">
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-surface text-ink">
            {tab === "requests" ? <MessageCircle className="h-8 w-8" strokeWidth={1.6} /> : <Bell className="h-8 w-8" strokeWidth={1.6} />}
          </span>
          <p className="mt-4 text-[18px] font-semibold tracking-[-0.01em] text-ink">{empty.title}</p>
          <p className="mt-1 text-[15px] leading-[20px] text-mute">{empty.sub}</p>
        </div>
      ) : (
        sections.map((s) => (
          <section key={s.label} className="mt-5" data-testid={`notifications-section-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <h2 className="px-1 text-[17px] font-bold tracking-[-0.01em] text-ink">{s.label}</h2>
            <div className="mt-2 -mx-1 space-y-[2px]">
              {s.items.map((it) => (
                <Row key={it.id} item={it} busy={busyId === it.id} onOpen={() => open(it)} onOpenProfile={() => openProfile(it)} onAccept={() => accept(it)} onDelete={() => remove(it)} />
              ))}
            </div>
          </section>
        ))
      )}

      <ProfileSheet profile={person} open={!!person} onOpenChange={(o) => !o && setPerson(null)} showMessage />
    </div>
  );
}
