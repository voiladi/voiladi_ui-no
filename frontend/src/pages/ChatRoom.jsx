import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, MoreHorizontal, ArrowUp, Check, CheckCheck, UserRound, Ban, ShieldAlert, HeartOff, Heart, MessageSquareText, Trash2, Copy, Undo2 } from "lucide-react";
import { notice } from "@/lib/feedback";
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useSocket } from "@/context/SocketContext";
import { useMeta } from "@/hooks/useMeta";
import { UserPhoto } from "@/components/UserPhoto";
import { ProfileSheet } from "@/components/ProfileSheet";
import { ConfirmDialog, ReportDialog } from "@/components/Dialogs";
import { ReactionPill, reactionLabel } from "@/components/ReactHeart";
import { Skeleton } from "@/components/EmptyState";
import { Spinner } from "@/components/Loading";
import { clockTime, dayLabel, timeAgo, activeLabel } from "@/lib/format";
import { tween } from "@/lib/motion";

/*
 * Conversation screen, on the soft canvas like the rest of the app:
 *  - round soft back / menu buttons, name + live status in the header
 *  - their messages: raised soft bubbles; mine: ink bubbles
 *  - press-and-hold one of your own bubbles to Unsend (removed for both) or Copy
 *  - message requests: the recipient sees Accept / Delete instead of the composer until they accept or reply
 *  - typing indicator, Seen ticks, polling fallback when the socket is down
 */

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const LONG_PRESS_MS = 420;

/** A like that was tied to a specific photo or prompt; opens the conversation. */
const ReactionBubble = ({ m, mine, otherName }) => {
  const r = m.reaction || {};
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-testid="chat-reaction-message">
      {r.type === "photo" ? (
        <div className="vo-soft relative overflow-hidden rounded-[20px]">
          <UserPhoto src={r.photo} name={mine ? otherName : ""} size="xs" className="h-48 w-40 text-3xl" />
          <span className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-red shadow-action">
            <Heart className="h-4 w-4" fill="currentColor" strokeWidth={2} />
          </span>
        </div>
      ) : (
        <div className="vo-soft max-w-[82%] rounded-[20px] px-4 py-3">
          <div className="mb-1 text-[12px] font-medium text-mute">{r.question}</div>
          <div className="text-[15px] leading-snug text-ink">{r.answer}</div>
        </div>
      )}
      <ReactionPill className="mt-1.5">{reactionLabel(r, { mine })}</ReactionPill>
    </div>
  );
};

/** Text bubble. Own bubbles support press-and-hold (touch / mouse) and right-click for the message actions sheet. */
const Bubble = ({ m, mine, onActions }) => {
  const timer = useRef(null);
  const fired = useRef(false);
  const start = () => {
    if (!mine || m.pending) return;
    fired.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fired.current = true;
      onActions(m);
    }, LONG_PRESS_MS);
  };
  const cancel = () => clearTimeout(timer.current);
  return (
    <div
      role={mine ? "button" : undefined}
      tabIndex={mine ? 0 : undefined}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        if (!mine) return;
        e.preventDefault();
        onActions(m);
      }}
      onKeyDown={(e) => {
        if (mine && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onActions(m);
        }
      }}
      className={`select-none whitespace-pre-wrap break-words px-4 py-2.5 text-[15.5px] leading-[1.35] tracking-[-0.005em] ${
        mine ? "rounded-[20px] rounded-br-[8px] bg-ink text-onink" : "vo-soft rounded-[20px] rounded-bl-[8px] text-ink"
      } ${m.pending ? "opacity-60" : ""}`}
      style={{ WebkitTouchCallout: "none" }}
      data-testid="chat-message-bubble"
      data-mine={mine ? "true" : "false"}
    >
      {m.text}
    </div>
  );
};

export default function ChatRoom() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { connected, subscribe, send } = useSocket();
  const { meta } = useMeta();
  const [match, setMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [icebreakers, setIcebreakers] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'unmatch' | 'block' | 'decline'
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState(null); // message under the Unsend / Copy sheet
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const suggestions = useMemo(() => shuffle(meta.icebreakers || []).slice(0, 3), [meta.icebreakers]);
  const drawerBreakers = useMemo(() => shuffle(meta.icebreakers || []).slice(0, 10), [meta.icebreakers, icebreakers]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDm = match?.kind === "dm";
  const isRequestForMe = !!match?.is_request;
  const requestSentByMe = isDm && match?.status === "request" && match?.requested_by === user?.id;

  const markRead = useCallback(async () => {
    try {
      await api.post(`/matches/${matchId}/read`);
      qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      // ignore
    }
  }, [matchId, qc]);

  const mergeMessages = useCallback((incoming) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      const byClient = new Map(prev.filter((m) => m.client_id).map((m) => [m.client_id, m]));
      const next = [...prev];
      incoming.forEach((m) => {
        if (byId.has(m.id)) return;
        if (m.client_id && byClient.has(m.client_id)) {
          const idx = next.findIndex((x) => x.client_id === m.client_id);
          if (idx >= 0) next[idx] = m;
          return;
        }
        next.push(m);
      });
      next.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ data: m }, { data: msgs }] = await Promise.all([api.get(`/matches/${matchId}`), api.get(`/matches/${matchId}/messages`)]);
        if (!alive) return;
        setMatch(m);
        setMessages(msgs.messages);
        if (m.unread > 0 && !m.is_request) markRead();
      } catch (e) {
        notice(errMsg(e, "This chat isn't available"));
        navigate("/chats", { replace: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [matchId, navigate, markRead]);

  useEffect(
    () =>
      subscribe((ev) => {
        if (ev.match_id !== matchId) return;
        if (ev.type === "message") {
          mergeMessages([ev.message]);
          if (ev.accepted) setMatch((m) => (m ? { ...m, status: "active", is_request: false } : m));
          if (ev.message.sender_id !== user?.id) {
            setTyping(false);
            if (!isRequestForMe) markRead();
          }
        } else if (ev.type === "typing") {
          setTyping(true);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTyping(false), 2500);
        } else if (ev.type === "read") {
          setMessages((prev) => prev.map((m) => (m.sender_id === user?.id && !m.read_at ? { ...m, read_at: ev.read_at } : m)));
        } else if (ev.type === "message_deleted") {
          setMessages((prev) => prev.filter((m) => m.id !== ev.message_id));
        } else if (ev.type === "dm_accepted") {
          setMatch((m) => (m ? { ...m, status: "active", is_request: false } : m));
        } else if (ev.type === "unmatch") {
          notice(isDm ? "This chat was deleted" : "This match has ended");
          navigate("/chats", { replace: true });
        }
      }),
    [subscribe, matchId, user?.id, mergeMessages, markRead, navigate, isRequestForMe, isDm]
  );

  // polling fallback when the socket is down
  useEffect(() => {
    if (connected || loading) return undefined;
    const t = setInterval(async () => {
      try {
        const { data } = await api.get(`/matches/${matchId}/messages`);
        mergeMessages(data.messages);
      } catch (e) {
        // ignore
      }
    }, 4000);
    return () => clearInterval(t);
  }, [connected, loading, matchId, mergeMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  const onType = (v) => {
    setText(v);
    const now = Date.now();
    if (v && now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      send({ type: "typing", match_id: matchId });
    }
  };

  const sendMessage = async (override) => {
    const body = (override ?? text).trim();
    if (!body || sending) return;
    const client_id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const temp = { id: `tmp_${client_id}`, client_id, match_id: matchId, sender_id: user.id, text: body, created_at: new Date().toISOString(), read_at: null, pending: true };
    setMessages((prev) => [...prev, temp]);
    setText("");
    setSending(true);
    try {
      const { data } = await api.post(`/matches/${matchId}/messages`, { text: body, client_id });
      mergeMessages([data]);
      if (isRequestForMe) setMatch((m) => ({ ...m, status: "active", is_request: false }));
      qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.client_id !== client_id));
      setText(body);
      notice(errMsg(e, "Message didn't send"));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const acceptRequest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/matches/${matchId}/accept`);
      setMatch(data);
      qc.invalidateQueries({ queryKey: ["matches"] });
      markRead();
      setTimeout(() => inputRef.current?.focus(), 150);
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const endThread = async () => {
    setBusy(true);
    try {
      await api.delete(`/matches/${matchId}`);
      qc.invalidateQueries({ queryKey: ["matches"] });
      navigate("/chats", { replace: true });
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const doBlock = async () => {
    setBusy(true);
    try {
      await api.post(`/users/${match.user.id}/block`);
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["likes"] });
      navigate("/chats", { replace: true });
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const doReport = async (reason, details) => {
    setBusy(true);
    try {
      await api.post(`/users/${match.user.id}/report`, { reason, details });
      return true;
    } catch (e) {
      notice(errMsg(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const unsend = async () => {
    const m = actionMsg;
    if (!m) return;
    setActionMsg(null);
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    try {
      await api.delete(`/matches/${matchId}/messages/${m.id}`);
      qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      mergeMessages([m]);
      notice(errMsg(e, "Couldn't unsend"));
    }
  };

  const copyText = async () => {
    const m = actionMsg;
    setActionMsg(null);
    try {
      await navigator.clipboard.writeText(m?.text || "");
      notice("Copied");
    } catch (e) {
      notice("Couldn't copy");
    }
  };

  const other = match?.user;

  const rendered = useMemo(() => {
    const out = [];
    let lastDay = null;
    messages.forEach((m, idx) => {
      const day = dayLabel(m.created_at);
      if (day !== lastDay) {
        out.push({ type: "day", key: `d_${m.created_at}`, label: day });
        lastDay = day;
      }
      const nextM = messages[idx + 1];
      const endOfGroup = !nextM || nextM.sender_id !== m.sender_id || new Date(nextM.created_at) - new Date(m.created_at) > 5 * 60 * 1000;
      out.push({ type: "msg", key: m.id, m, endOfGroup });
    });
    return out;
  }, [messages]);

  const lastMine = [...messages].reverse().find((m) => m.sender_id === user?.id);
  const noTextYet = messages.every((m) => m.kind === "reaction");
  const status = typing ? "typing..." : match?.online ? "Online" : activeLabel(other?.last_active) || "";

  const intro = () => {
    if (!other) return null;
    const ago = timeAgo(match.created_at) === "now" ? "just now" : `${timeAgo(match.created_at)} ago`;
    if (isRequestForMe) return <><span className="font-semibold text-ink">{other.name}</span> wants to send you a message · {ago}</>;
    if (isDm && requestSentByMe) return <>You sent <span className="font-semibold text-ink">{other.name}</span> a message request · {ago}. They'll see it under Requests.</>;
    if (isDm) return <>You and <span className="font-semibold text-ink">{other.name}</span> started talking {ago}</>;
    return <>You matched with <span className="font-semibold text-ink">{other.name}</span> {ago}{other.shared_interests?.length ? ` · you both like ${other.shared_interests[0]}` : ""}</>;
  };

  const composerHidden = isRequestForMe;

  return (
    <div className="vo-neu-page flex h-full flex-col" data-testid="chat-room" data-kind={match?.kind} data-status={match?.status}>
      {/* header */}
      <header className="flex h-[64px] shrink-0 items-center gap-2.5 px-3">
        <button type="button" className="vo-soft-icon h-[44px] w-[44px] shrink-0" onClick={() => navigate("/chats")} aria-label="Back" data-testid="chat-back-button">
          <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
        </button>
        {other ? (
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-1 text-left active:opacity-70" onClick={() => setSheet(true)} data-testid="chat-header-profile">
            <span className="relative shrink-0">
              <UserPhoto src={other.photos?.[0]} name={other.name} size="xs" className="h-[40px] w-[40px] rounded-full text-sm" />
              {match.online && <span className="vo-dot-online h-2.5 w-2.5" />}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[17px] font-semibold leading-tight tracking-[-0.01em] text-ink">
                <span className="truncate">{other.name}</span>
                {other.verified && <VerifiedBadge size={16} testId="chat-header-verified" />}
              </span>
              {status && (
                <span className="block text-[12.5px] leading-tight text-mute" data-testid="chat-header-status">
                  {status}
                </span>
              )}
            </span>
          </button>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="vo-soft-icon h-[44px] w-[44px] shrink-0" aria-label="More" data-testid="chat-menu-button">
              <MoreHorizontal className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-[18px] border-0 bg-canvas p-1.5 shadow-modal">
            <DropdownMenuItem className="rounded-[12px] py-2.5 text-[15px]" onClick={() => setSheet(true)} data-testid="chat-menu-view-profile">
              <UserRound className="mr-2 h-4 w-4" /> View profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isDm ? (
              <DropdownMenuItem className="rounded-[12px] py-2.5 text-[15px]" onClick={() => setConfirm("decline")} data-testid="chat-menu-delete-chat">
                <Trash2 className="mr-2 h-4 w-4" /> Delete chat
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="rounded-[12px] py-2.5 text-[15px]" onClick={() => setConfirm("unmatch")} data-testid="chat-menu-unmatch">
                <HeartOff className="mr-2 h-4 w-4" /> Unmatch
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="rounded-[12px] py-2.5 text-[15px]" onClick={() => setReport(true)} data-testid="chat-menu-report">
              <ShieldAlert className="mr-2 h-4 w-4" /> Report
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-[12px] py-2.5 text-[15px] text-red focus:text-red" onClick={() => setConfirm("block")} data-testid="chat-menu-block">
              <Ban className="mr-2 h-4 w-4" /> Block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {!connected && !loading && (
        <div className="mx-auto mb-1 inline-flex h-[26px] items-center rounded-full bg-[#262626] px-3 text-[12px] font-medium text-white" data-testid="chat-offline-banner">
          Reconnecting... messages will still arrive.
        </div>
      )}

      {/* messages */}
      <div className="vo-scroll px-4 pb-3 pt-2" data-testid="chat-messages">
        {loading ? (
          <div className="flex h-full min-h-[40vh] items-center justify-center text-ink" data-testid="chat-loading">
            <Spinner size={28} stroke={2.5} />
          </div>
        ) : (
          <>
            {other && (
              <div className="mb-6 flex flex-col items-center text-center" data-testid="chat-intro">
                <button type="button" onClick={() => setSheet(true)} className="flex items-center active:opacity-80" aria-label={`View ${other.name}'s profile`}>
                  <UserPhoto src={user?.photos?.[0]} name={user?.name} size="xs" className="h-16 w-16 rounded-full border-[3px] border-canvas text-lg" />
                  <UserPhoto src={other.photos?.[0]} name={other.name} size="xs" className="-ml-4 h-16 w-16 rounded-full border-[3px] border-canvas text-lg" />
                </button>
                <p className="mt-3 max-w-[300px] text-[13px] leading-[17px] text-mute" data-testid="chat-intro-text">
                  {intro()}
                </p>
                {noTextYet && !composerHidden && !isDm && (
                  <div className="mt-5 w-full">
                    <div className="mb-2.5 text-[12px] font-semibold text-mute">Vibe check</div>
                    <div className="flex flex-col gap-2">
                      {suggestions.map((s) => (
                        <button key={s} type="button" className="vo-soft h-auto justify-start whitespace-normal rounded-[18px] px-4 py-2.5 text-left text-[14px] text-ink active:opacity-80" onClick={() => sendMessage(s)} data-testid="chat-suggestion-chip">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <AnimatePresence initial={false}>
              {rendered.map((r) =>
                r.type === "day" ? (
                  <div key={r.key} className="my-4 flex items-center justify-center">
                    <span className="text-[12px] font-medium text-mute">{r.label}</span>
                  </div>
                ) : (
                  <motion.div
                    key={r.key}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={tween(0.18)}
                    className={`flex ${r.m.sender_id === user?.id ? "justify-end" : "justify-start"} ${r.endOfGroup ? "mb-3" : "mb-1.5"}`}
                  >
                    <div className={`max-w-[78%] ${r.m.sender_id === user?.id ? "items-end" : "items-start"} flex flex-col`}>
                      {r.m.kind === "reaction" ? (
                        <ReactionBubble m={r.m} mine={r.m.sender_id === user?.id} otherName={other?.name} />
                      ) : (
                        <Bubble m={r.m} mine={r.m.sender_id === user?.id} onActions={setActionMsg} />
                      )}
                      {r.endOfGroup && (
                        <div className="mt-1 flex items-center gap-1 px-1 text-[11px] text-mute">
                          {clockTime(r.m.created_at)}
                          {r.m.sender_id === user?.id && r.m.id === lastMine?.id && (
                            r.m.read_at ? (
                              <span className="inline-flex items-center gap-0.5 text-blue" data-testid="chat-seen">
                                <CheckCheck className="h-3 w-3" /> Seen
                              </span>
                            ) : (
                              <Check className="h-3 w-3" data-testid="chat-sent-tick" />
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              )}
            </AnimatePresence>
            {typing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tween(0.15)} className="mb-2 flex justify-start" data-testid="chat-typing-indicator">
                <div className="vo-soft flex items-center gap-1 rounded-[20px] px-4 py-3">
                  <span className="typing-dot h-2 w-2 rounded-full bg-mute" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-mute" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-mute" />
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* bottom: request bar / verify gate / composer */}
      {loading ? null : isRequestForMe ? (
        <div className="px-4 pt-2" style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }} data-testid="chat-request-bar">
          <div className="vo-soft rounded-[24px] p-4">
            <p className="text-[15px] font-semibold leading-[19px] tracking-[-0.01em] text-ink">{other?.name} wants to send you a message</p>
            <p className="mt-1 text-[13px] leading-[17px] text-mute">Accept to reply. They won't know you've seen this until you do. Not a match - deleting just removes the request.</p>
            <div className="mt-3.5 flex gap-2.5">
              <button type="button" onClick={() => setConfirm("decline")} disabled={busy} className="vo-soft-btn h-[46px] flex-1 text-[15px]" data-testid="chat-request-delete-button">
                Delete
              </button>
              <button type="button" onClick={acceptRequest} disabled={busy} aria-busy={busy} className="inline-flex h-[46px] flex-1 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-onink active:scale-[0.98] disabled:opacity-60" style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }} data-testid="chat-request-accept-button">
                {busy ? <Spinner size={18} stroke={2.4} /> : "Accept"}
              </button>
            </div>
            <button type="button" onClick={() => setConfirm("block")} className="mt-3 block w-full text-center text-[13px] font-medium text-mute active:opacity-60" data-testid="chat-request-block-button">
              Block {other?.name}
            </button>
          </div>
        </div>
      ) : !user?.verified ? (
        <div className="px-4 pt-2" style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }} data-testid="chat-verify-gate">
          <div className="vo-soft flex items-center gap-3 rounded-[24px] p-3.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">Verify your profile to send messages</span>
              <span className="block text-[13px] text-mute">A quick selfie gets you the black tick.</span>
            </span>
            <button type="button" onClick={() => navigate("/settings/verification")} className="h-[40px] shrink-0 rounded-full bg-ink px-5 text-[15px] font-semibold text-onink active:scale-95" style={{ transitionProperty: "transform", transitionDuration: "120ms" }} data-testid="chat-verify-button">
              Verify
            </button>
          </div>
        </div>
      ) : (
        <form
          className="px-3 pt-1.5"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <div className="flex items-end gap-2">
            {!isDm && (
              <button type="button" className="vo-soft-icon h-[46px] w-[46px] shrink-0" onClick={() => setIcebreakers(true)} aria-label="Vibe check prompts" data-testid="chat-icebreakers-open-button">
                <MessageSquareText className="h-5 w-5" strokeWidth={1.9} />
              </button>
            )}
            <div className="vo-soft-sunken flex min-h-[46px] flex-1 items-end rounded-[23px] px-4">
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Message"
                className="max-h-[120px] w-full resize-none bg-transparent py-[13px] text-[15.5px] leading-[20px] text-ink outline-none placeholder:text-mute"
                style={{ height: Math.min(120, 26 + 20 * Math.max(1, text.split("\n").length)) }}
                data-testid="chat-message-input"
              />
            </div>
            <button type="submit" disabled={!text.trim() || sending} aria-busy={sending} className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-ink text-onink active:scale-95 disabled:opacity-40" style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }} aria-label="Send" data-testid="chat-send-button">
              {sending ? <Spinner size={18} stroke={2.4} /> : <ArrowUp className="h-5 w-5" strokeWidth={2.5} />}
            </button>
          </div>
        </form>
      )}

      {/* message actions (own bubbles) */}
      <Drawer open={!!actionMsg} onOpenChange={(o) => !o && setActionMsg(null)}>
        <DrawerContent className="mx-auto max-w-[430px] rounded-t-[28px] border-0 bg-canvas" data-testid="message-actions-sheet">
          <DrawerTitle className="sr-only">Message options</DrawerTitle>
          <DrawerDescription className="sr-only">Unsend or copy this message</DrawerDescription>
          <div className="px-5 pb-8 pt-3">
            {actionMsg && (
              <p className="vo-soft-sunken mb-4 max-h-[88px] overflow-hidden text-ellipsis whitespace-pre-wrap break-words rounded-[18px] px-4 py-3 text-[14px] leading-[19px] text-ink" data-testid="message-actions-preview">
                {actionMsg.text}
              </p>
            )}
            <div className="flex flex-col gap-2.5">
              <button type="button" className="vo-soft-row min-h-[54px] justify-start text-[16px] font-semibold text-ink" onClick={copyText} data-testid="message-copy-button">
                <Copy className="h-5 w-5" strokeWidth={2} /> Copy
              </button>
              <button type="button" className="vo-soft-row min-h-[54px] justify-start text-[16px] font-semibold text-red" onClick={unsend} data-testid="message-unsend-button">
                <Undo2 className="h-5 w-5" strokeWidth={2} /> Unsend
              </button>
            </div>
            <p className="mt-3 text-center text-[12.5px] text-mute">Unsending removes the message for both of you.</p>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={icebreakers} onOpenChange={setIcebreakers}>
        <DrawerContent className="mx-auto max-h-[80dvh] max-w-[430px] rounded-t-[28px] border-0 bg-canvas" data-testid="icebreakers-drawer">
          <DrawerTitle className="mt-3 px-5 text-[18px] font-bold text-ink">Vibe check</DrawerTitle>
          <DrawerDescription className="mb-3 mt-1 px-5 text-[13px] text-mute">Tap one to drop it into the chat. Edit it or send as is.</DrawerDescription>
          <div className="vo-scroll flex flex-wrap gap-2 px-5 pb-8">
            {drawerBreakers.map((s) => (
              <button
                key={s}
                type="button"
                className="vo-soft h-auto whitespace-normal rounded-[16px] px-3.5 py-2.5 text-left text-[14px] text-ink active:opacity-80"
                onClick={() => {
                  setText(s);
                  setIcebreakers(false);
                  setTimeout(() => inputRef.current?.focus(), 200);
                }}
                data-testid="icebreaker-chip"
              >
                {s}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <ProfileSheet profile={other} open={sheet} onOpenChange={setSheet} showMessage={false} onBlock={() => { setSheet(false); setConfirm("block"); }} onReport={() => { setSheet(false); setReport(true); }} />
      <ConfirmDialog
        open={confirm === "unmatch"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Unmatch ${other?.name}?`}
        description="This removes the chat for both of you. You won't see each other in Discover again."
        confirmText="Unmatch"
        danger
        loading={busy}
        onConfirm={endThread}
        testId="unmatch-dialog"
      />
      <ConfirmDialog
        open={confirm === "decline"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={isRequestForMe ? "Delete this request?" : "Delete this chat?"}
        description={isRequestForMe ? `${other?.name} won't be told. You can still find them in Explore.` : "This removes the conversation for both of you."}
        confirmText="Delete"
        danger
        loading={busy}
        onConfirm={endThread}
        testId="delete-chat-dialog"
      />
      <ConfirmDialog
        open={confirm === "block"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Block ${other?.name}?`}
        description="They won't be able to see your profile or message you. They won't be notified."
        confirmText="Block"
        danger
        loading={busy}
        onConfirm={doBlock}
        testId="block-dialog"
      />
      <ReportDialog open={report} onOpenChange={setReport} reasons={meta.report_reasons} onSubmit={doReport} loading={busy} name={other?.name} />
    </div>
  );
}
