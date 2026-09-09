import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MoreHorizontal, Send, Zap, Check, CheckCheck, UserRound, Ban, ShieldAlert, HeartOff, Heart, Quote } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useMeta } from "@/hooks/useMeta";
import { UserPhoto } from "@/components/UserPhoto";
import { ProfileSheet } from "@/components/ProfileSheet";
import { ConfirmDialog, ReportDialog } from "@/components/Dialogs";
import { ReactionPill, reactionLabel } from "@/components/ReactHeart";
import { Skeleton } from "@/components/EmptyState";
import { clockTime, dayLabel, timeAgo } from "@/lib/format";
import { tween } from "@/lib/motion";

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

/** A like that was tied to a specific photo or prompt; opens the conversation Hinge-style. */
const ReactionBubble = ({ m, mine, otherName }) => {
  const r = m.reaction || {};
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-testid="chat-reaction-message">
      {r.type === "photo" ? (
        <div className="relative overflow-hidden rounded-card bg-surface2">
          <UserPhoto src={r.photo} name={mine ? otherName : ""} className="h-48 w-40 text-3xl" />
          <span className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-soft">
            <Heart className="h-4 w-4 fill-ink" strokeWidth={2.5} />
          </span>
        </div>
      ) : (
        <div className="max-w-[82%] rounded-card bg-surface2 px-4 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-mute">
            <Quote className="h-3 w-3" /> {r.question}
          </div>
          <div className="font-display text-[16px] leading-snug text-ink">{r.answer}</div>
        </div>
      )}
      <ReactionPill className="mt-1.5">{reactionLabel(r, { mine })}</ReactionPill>
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
  const [confirm, setConfirm] = useState(null); // 'unmatch' | 'block'
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const suggestions = useMemo(() => shuffle(meta.icebreakers || []).slice(0, 3), [meta.icebreakers]);
  const drawerBreakers = useMemo(() => shuffle(meta.icebreakers || []).slice(0, 10), [meta.icebreakers, icebreakers]); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (m.unread > 0) markRead();
      } catch (e) {
        toast.error(errMsg(e, "This chat isn't available"));
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
          if (ev.message.sender_id !== user?.id) {
            setTyping(false);
            markRead();
          }
        } else if (ev.type === "typing") {
          setTyping(true);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTyping(false), 2500);
        } else if (ev.type === "read") {
          setMessages((prev) => prev.map((m) => (m.sender_id === user?.id && !m.read_at ? { ...m, read_at: ev.read_at } : m)));
        } else if (ev.type === "unmatch") {
          toast("This match has ended");
          navigate("/chats", { replace: true });
        }
      }),
    [subscribe, matchId, user?.id, mergeMessages, markRead, navigate]
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
      qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.client_id !== client_id));
      setText(body);
      toast.error(errMsg(e, "Message didn't send"));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const doUnmatch = async () => {
    setBusy(true);
    try {
      await api.delete(`/matches/${matchId}`);
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast("Unmatched");
      navigate("/chats", { replace: true });
    } catch (e) {
      toast.error(errMsg(e));
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
      toast(`${match.user.name} is blocked`);
      navigate("/chats", { replace: true });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const doReport = async (reason, details) => {
    setBusy(true);
    try {
      await api.post(`/users/${match.user.id}/report`, { reason, details });
      toast("Report received. Thank you.");
      setReport(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
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

  return (
    <div className="flex h-full flex-col" data-testid="chat-room">
      <header className="vo-bar flex items-center gap-2 border-b border-line px-3 py-2.5">
        <button type="button" className="vo-icon-btn bg-transparent" onClick={() => navigate("/chats")} aria-label="Back" data-testid="chat-back-button">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {other ? (
          <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-btn px-1 py-1 text-left active:bg-surface2" onClick={() => setSheet(true)} data-testid="chat-header-profile">
            <span className="relative">
              <UserPhoto src={other.photos?.[0]} name={other.name} className="h-10 w-10 rounded-full" />
              {match.online && <span className="vo-dot-online h-3 w-3" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[17px] font-semibold text-ink">{other.name}</span>
              <span className="block text-[12px] text-mute">{typing ? "typing..." : match.online ? "Online" : `${other.compatibility}% match`}</span>
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
            <button type="button" className="vo-icon-btn bg-transparent" aria-label="More" data-testid="chat-menu-button">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-card border-line p-1.5 shadow-float">
            <DropdownMenuItem className="rounded-[10px] py-2.5" onClick={() => setSheet(true)} data-testid="chat-menu-view-profile">
              <UserRound className="mr-2 h-4 w-4" /> View profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-[10px] py-2.5" onClick={() => setConfirm("unmatch")} data-testid="chat-menu-unmatch">
              <HeartOff className="mr-2 h-4 w-4" /> Unmatch
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-[10px] py-2.5" onClick={() => setReport(true)} data-testid="chat-menu-report">
              <ShieldAlert className="mr-2 h-4 w-4" /> Report
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-[10px] py-2.5 text-danger focus:text-danger" onClick={() => setConfirm("block")} data-testid="chat-menu-block">
              <Ban className="mr-2 h-4 w-4" /> Block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {!connected && !loading && (
        <div className="bg-surface2 px-4 py-1.5 text-center text-[12px] font-medium text-mute" data-testid="chat-offline-banner">
          Reconnecting... messages will still arrive.
        </div>
      )}

      <div className="vo-scroll px-4 pb-3 pt-4" data-testid="chat-messages">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="ml-auto h-10 w-44 rounded-[18px]" />
            <Skeleton className="h-10 w-56 rounded-[18px]" />
            <Skeleton className="ml-auto h-10 w-32 rounded-[18px]" />
          </div>
        ) : (
          <>
            {other && (
              <div className="mb-6 flex flex-col items-center text-center" data-testid="chat-intro">
                <div className="flex items-center">
                  <UserPhoto src={user?.photos?.[0]} name={user?.name} className="h-16 w-16 rounded-full border-[3px] border-white text-lg shadow-soft" />
                  <UserPhoto src={other.photos?.[0]} name={other.name} className="-ml-4 h-16 w-16 rounded-full border-[3px] border-white text-lg shadow-soft" />
                </div>
                <p className="mt-3 text-[14px] text-mute">
                  You matched with <span className="font-semibold text-ink">{other.name}</span> {timeAgo(match.created_at) === "now" ? "just now" : `${timeAgo(match.created_at)} ago`}
                  {other.shared_interests?.length ? ` · you both like ${other.shared_interests[0]}` : ""}
                </p>
                {noTextYet && (
                  <div className="mt-5 w-full">
                    <div className="vo-label mb-2.5 flex items-center justify-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Break the ice
                    </div>
                    <div className="flex flex-col gap-2">
                      {suggestions.map((s) => (
                        <button key={s} type="button" className="vo-chip h-auto justify-start whitespace-normal px-4 py-2.5 text-left text-[14px]" onClick={() => sendMessage(s)} data-testid="chat-suggestion-chip">
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
                    <span className="text-[11px] font-medium text-mute">{r.label}</span>
                  </div>
                ) : (
                  <motion.div
                    key={r.key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={tween(0.2)}
                    className={`flex ${r.m.sender_id === user?.id ? "justify-end" : "justify-start"} ${r.endOfGroup ? "mb-3" : "mb-1"}`}
                  >
                    <div className={`max-w-[78%] ${r.m.sender_id === user?.id ? "items-end" : "items-start"} flex flex-col`}>
                      {r.m.kind === "reaction" ? (
                        <ReactionBubble m={r.m} mine={r.m.sender_id === user?.id} otherName={other?.name} />
                      ) : (
                        <div
                          className={`whitespace-pre-wrap break-words px-3.5 py-2.5 text-[15px] leading-snug ${
                            r.m.sender_id === user?.id
                              ? "rounded-[18px] rounded-br-[6px] bg-tint text-white"
                              : "rounded-[18px] rounded-bl-[6px] bg-surface2 text-ink"
                          } ${r.m.pending ? "opacity-60" : ""}`}
                          data-testid="chat-message-bubble"
                        >
                          {r.m.text}
                        </div>
                      )}
                      {r.endOfGroup && (
                        <div className="mt-1 flex items-center gap-1 px-1 text-[11px] text-mute">
                          {clockTime(r.m.created_at)}
                          {r.m.sender_id === user?.id && r.m.id === lastMine?.id && (
                            r.m.read_at ? (
                              <span className="inline-flex items-center gap-0.5 text-tint" data-testid="chat-seen">
                                <CheckCheck className="h-3.5 w-3.5" /> Seen
                              </span>
                            ) : (
                              <Check className="h-3.5 w-3.5" />
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
                <div className="flex items-center gap-1 rounded-[18px] rounded-bl-[6px] bg-surface2 px-4 py-3">
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

      <form
        className="vo-bar border-t border-line px-3 pt-2.5"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
      >
        <div className="flex items-end gap-2">
          <button type="button" className="vo-icon-btn h-11 w-11 shrink-0 text-tint" onClick={() => setIcebreakers(true)} aria-label="Icebreakers" data-testid="chat-icebreakers-open-button">
            <Zap className="h-5 w-5 fill-tint" />
          </button>
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
            placeholder={other ? `Message ${other.name}` : "Message"}
            className="vo-textarea max-h-[120px] min-h-[44px] flex-1 rounded-[22px] border-line bg-white px-4 py-2.5 text-[15px] focus:border-mute2"
            style={{ height: Math.min(120, 24 + 20 * Math.max(1, text.split("\n").length)) }}
            data-testid="chat-message-input"
          />
          <button type="submit" disabled={!text.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint text-white transition-[background-color,transform] duration-150 ease-ios hover:bg-tint-dark active:scale-95 disabled:opacity-40" aria-label="Send" data-testid="chat-send-button">
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>

      <Drawer open={icebreakers} onOpenChange={setIcebreakers}>
        <DrawerContent className="mx-auto max-h-[80dvh] max-w-[430px] rounded-t-sheet border-0 bg-white" data-testid="icebreakers-drawer">
          <DrawerTitle className="vo-h2 mt-3 px-5">Vibe check</DrawerTitle>
          <DrawerDescription className="mb-3 mt-1 px-5 text-[14px] text-mute">Tap one to drop it into the chat. Edit it or send as is.</DrawerDescription>
          <div className="vo-scroll flex flex-wrap gap-2 px-5 pb-8">
            {drawerBreakers.map((s) => (
              <button
                key={s}
                type="button"
                className="vo-chip h-auto whitespace-normal px-4 py-2.5 text-left text-[14px]"
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

      <ProfileSheet profile={other} open={sheet} onOpenChange={setSheet} onBlock={() => { setSheet(false); setConfirm("block"); }} onReport={() => { setSheet(false); setReport(true); }} />
      <ConfirmDialog
        open={confirm === "unmatch"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Unmatch ${other?.name}?`}
        description="This removes the chat for both of you. You won't see each other in Discover again."
        confirmText="Unmatch"
        danger
        loading={busy}
        onConfirm={doUnmatch}
        testId="unmatch-dialog"
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
