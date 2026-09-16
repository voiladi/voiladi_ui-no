import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as AD from "@radix-ui/react-alert-dialog";
import { ArrowUp, Check, Search } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { UserPhoto } from "@/components/UserPhoto";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Spinner, SkeletonList } from "@/components/Loading";
import { api, errMsg } from "@/lib/api";
import { notice } from "@/lib/feedback";
import { timeAgo } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

/* ---------- Comments ---------- */
export const CommentsSheet = ({ post, open, onOpenChange, onCount }) => {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!open || !post) return;
    setList(null);
    setText("");
    api
      .get(`/posts/${post.id}/comments`)
      .then(({ data }) => setList(data.comments))
      .catch((e) => {
        notice(errMsg(e, "Couldn't load comments"));
        setList([]);
      });
  }, [open, post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t || busy || !post) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/posts/${post.id}/comments`, { text: t });
      setList((l) => [...(l || []), data]);
      setText("");
      onCount?.(post.id, data.count);
      setTimeout(() => endRef.current?.scrollIntoView({ block: "end" }), 50);
    } catch (err) {
      notice(errMsg(err, "Comment didn't post"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    try {
      const { data } = await api.delete(`/posts/${post.id}/comments/${c.id}`);
      setList((l) => l.filter((x) => x.id !== c.id));
      onCount?.(post.id, data.count);
    } catch (err) {
      notice(errMsg(err));
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto flex h-[72dvh] max-w-[430px] flex-col rounded-t-[24px] border-0 bg-bg" data-testid="comments-sheet">
        <DrawerTitle className="pt-1 text-center text-[16px] font-bold tracking-[-0.01em] text-ink">Comments</DrawerTitle>
        <DrawerDescription className="sr-only">Comments on this post</DrawerDescription>
        <div className="vo-scroll flex-1 px-4 pt-3">
          {list === null ? (
            <SkeletonList rows={4} avatar={40} />
          ) : list.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center" data-testid="comments-empty">
              <p className="text-[20px] font-bold text-ink">No comments yet</p>
              <p className="mt-1 text-[15px] text-mute">Start the conversation.</p>
            </div>
          ) : (
            list.map((c) => (
              <div key={c.id} className="flex items-start gap-3 py-2.5" data-testid="comment-row">
                <span className="shrink-0">
                  <UserPhoto src={c.author?.photo} name={c.author?.name} size="xs" className="h-[38px] w-[38px] rounded-full text-[14px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13.5px] text-mute">
                    <span className="font-semibold text-ink">{c.author?.username ? `@${c.author.username}` : c.author?.name}</span>
                    {c.author?.verified && <VerifiedBadge size={14} />}
                    <span>{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[15.5px] leading-[20px] text-ink">{c.text}</p>
                  {(c.mine || post?.mine) && (
                    <button type="button" onClick={() => remove(c)} className="mt-1 text-[12.5px] font-medium text-mute active:opacity-60" data-testid="comment-delete-button">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
        {post?.comments_off && !post?.mine ? (
          <div className="flex items-center justify-center border-t border-line/70 px-4 pt-3 text-center text-[14.5px] text-mute" style={{ paddingBottom: "calc(14px + var(--safe-bottom))" }} data-testid="comments-off-notice">
            Comments on this post have been turned off.
          </div>
        ) : (
        <form onSubmit={send} className="flex items-center gap-2.5 border-t border-line/70 px-3 pt-2.5" style={{ paddingBottom: "calc(10px + var(--safe-bottom))" }}>
          <UserPhoto src={user?.photos?.[0]} name={user?.name} size="xs" className="h-[36px] w-[36px] shrink-0 rounded-full text-[13px]" />
          <div className="flex h-[42px] min-w-0 flex-1 items-center rounded-full bg-surface2 pl-4 pr-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Add a comment for ${post?.author?.username || post?.author?.name || ""}...`}
              maxLength={500}
              className="min-w-0 flex-1 bg-transparent text-[15.5px] text-ink placeholder:text-mute focus:outline-none"
              data-testid="comment-input"
            />
            <button type="submit" disabled={!text.trim() || busy} aria-label="Post comment" className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-ink text-onink disabled:opacity-30" data-testid="comment-send-button">
              {busy ? <Spinner size={16} stroke={2.2} /> : <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.6} />}
            </button>
          </div>
        </form>
        )}
      </DrawerContent>
    </Drawer>
  );
};

/* ---------- Share to a chat ---------- */
export const ShareSheet = ({ post, open, onOpenChange, onShared }) => {
  const [q, setQ] = useState("");
  const [sent, setSent] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const threads = useQuery({
    queryKey: ["matches"],
    queryFn: async () => (await api.get("/matches")).data,
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (open) {
      setSent(new Set());
      setQ("");
    }
  }, [open, post?.id]);

  const rows = (threads.data?.matches || []).filter((m) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return (m.user?.name || "").toLowerCase().includes(t) || (m.user?.username || "").toLowerCase().includes(t);
  });

  const send = async (m) => {
    if (busyId || sent.has(m.id)) return;
    setBusyId(m.id);
    try {
      const { data } = await api.post(`/posts/${post.id}/share`, { match_id: m.id });
      setSent((s) => new Set([...s, m.id]));
      onShared?.(post.id, data.shares);
    } catch (e) {
      notice(errMsg(e, "Couldn't share"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto flex h-[70dvh] max-w-[430px] flex-col rounded-t-[24px] border-0 bg-bg" data-testid="share-sheet">
        <DrawerTitle className="pt-1 text-center text-[16px] font-bold tracking-[-0.01em] text-ink">Share</DrawerTitle>
        <DrawerDescription className="sr-only">Send this post to a chat</DrawerDescription>
        <div className="px-4 pt-3">
          <div className="flex h-[42px] items-center gap-2 rounded-full bg-surface2 px-4">
            <Search className="h-[18px] w-[18px] text-mute" strokeWidth={2} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="min-w-0 flex-1 bg-transparent text-[15.5px] text-ink placeholder:text-mute focus:outline-none" data-testid="share-search-input" />
          </div>
        </div>
        <div className="vo-scroll flex-1 px-4 pb-6 pt-2">
          {threads.isLoading ? (
            <SkeletonList rows={5} avatar={48} />
          ) : rows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center" data-testid="share-empty">
              <p className="text-[20px] font-bold text-ink">No chats yet</p>
              <p className="mt-1 text-[15px] text-mute">Start a conversation first, then share posts here.</p>
            </div>
          ) : (
            rows.map((m) => {
              const done = sent.has(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5" data-testid="share-row">
                  <UserPhoto src={m.user?.photos?.[0]} name={m.user?.name} size="xs" className="h-[48px] w-[48px] shrink-0 rounded-full text-[16px]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[16px] font-semibold text-ink">{m.user?.name}</span>
                      {m.user?.verified && <VerifiedBadge size={15} />}
                    </div>
                    {m.user?.username && <div className="truncate text-[13.5px] text-mute">@{m.user.username}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => send(m)}
                    disabled={done || busyId === m.id}
                    className={`inline-flex h-[36px] min-w-[74px] items-center justify-center rounded-full px-4 text-[14.5px] font-semibold ${done ? "bg-surface2 text-mute" : "bg-ink text-onink"} disabled:opacity-90`}
                    data-testid="share-send-button"
                  >
                    {busyId === m.id ? <Spinner size={16} stroke={2.2} /> : done ? <span className="inline-flex items-center gap-1"><Check className="h-4 w-4" strokeWidth={2.6} /> Sent</span> : "Send"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

/* ---------- "..." : Not interested / Copy link / Report (iOS action sheet) ---------- */
export const MoreSheet = ({ post, open, onOpenChange, onNotInterested, onReport, onDelete }) => {
  const copy = async () => {
    const url = `${window.location.origin}/p/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      notice("Link copied");
    } catch (e) {
      notice(url);
    }
    onOpenChange(false);
  };
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal>
        <AD.Overlay className="vo-sheet-overlay" />
        <AD.Content className="vo-sheet vo-apple" data-testid="post-more-sheet" onOpenAutoFocus={(e) => e.preventDefault()}>
          <AD.Title className="sr-only">Post options</AD.Title>
          <AD.Description className="sr-only">Choose what to do with this post</AD.Description>
          <div className="vo-sheet-group">
            {post?.mine ? (
              <button type="button" className="vo-sheet-action vo-sheet-danger" onClick={() => { onOpenChange(false); onDelete?.(post); }} data-testid="post-delete-button">
                Delete post
              </button>
            ) : (
              <button type="button" className="vo-sheet-action" onClick={() => { onOpenChange(false); onNotInterested(post); }} data-testid="post-not-interested-button">
                Not interested
              </button>
            )}
            <button type="button" className="vo-sheet-action" onClick={copy} data-testid="post-copy-link-button">
              Copy link
            </button>
            {!post?.mine && (
              <button type="button" className="vo-sheet-action vo-sheet-danger" onClick={() => { onOpenChange(false); onReport(post); }} data-testid="post-report-button">
                Report
              </button>
            )}
          </div>
          <button type="button" className="vo-sheet-cancel" onClick={() => onOpenChange(false)} data-testid="post-more-cancel">
            Cancel
          </button>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
};
