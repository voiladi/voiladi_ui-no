import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as AD from "@radix-ui/react-alert-dialog";
import { ArrowUp, Play, RotateCcw } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { UserPhoto } from "@/components/UserPhoto";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ProfileSheet } from "@/components/ProfileSheet";
import { Spinner, Skeleton } from "@/components/Loading";
import { ProviderMark } from "@/pages/settings/AiAssistant";
import { useAiLinks } from "@/hooks/useAiLinks";
import { captureRegion, collectContext, markedBBox } from "@/lib/aiCapture";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/*
 * Orb visual search. Listens for the tab bar's `voiladi:ink` stroke:
 *  - nothing linked  -> iOS sheet "Connect your AI" -> Settings > AI Assistant
 *  - linked          -> grabs the circled area of the screen, asks the user's own model, shows the reply in a glass
 *                       drawer with "Found in Voiladi" (people / posts / communities) and a follow-up composer.
 */
const MIN_STROKE = 24; // px - anything smaller is a twitch, not a circle

const PersonRow = ({ p, onOpen, last }) => (
  <button type="button" className={`flex w-full items-center gap-3 py-2.5 text-left focus-visible:outline-none active:opacity-80 ${last ? "" : "border-b border-line/80"}`} onClick={() => onOpen(p)} data-testid="ai-person-row">
    <UserPhoto src={p.photos?.[0]} name={p.name} size="xs" className="h-[46px] w-[46px] shrink-0 rounded-full text-base" />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5 text-[16px] font-bold leading-[20px] tracking-[-0.01em] text-ink">
        <span className="truncate">{p.name}</span>
        {p.verified && <VerifiedBadge size={15} />}
      </span>
      <span className="mt-0.5 block truncate text-[14px] leading-[18px] text-mute">{p.username ? `@${p.username}` : ""}{p.username && (p.interests || []).length ? " · " : ""}{(p.interests || []).slice(0, 2).join(", ")}</span>
    </span>
  </button>
);

export const AiSearchLayer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { links, active, isFetched, refresh } = useAiLinks();
  const [connectSheet, setConnectSheet] = useState(false);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [thread, setThread] = useState([]); // [{role, text, found?}]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [person, setPerson] = useState(null);
  const scrollRef = useRef(null);
  const imageRef = useRef(null);
  const linksRef = useRef({ links, active, isFetched });
  linksRef.current = { links, active, isFetched };

  const ask = useCallback(
    async (q, history, image, context) => {
      setBusy(true);
      setError("");
      try {
        const { data } = await api.post("/ai/lookup", {
          image,
          route: context?.route || window.location.pathname,
          texts: context?.texts || [],
          user_ids: context?.user_ids || [],
          post_ids: context?.post_ids || [],
          question: q || undefined,
          history: history.map((t) => ({ role: t.role, text: t.text })),
        }, { timeout: 95000 });
        setThread((prev) => [...prev, { role: "assistant", text: data.answer, found: data.found, provider: data.provider, model: data.model, provider_name: data.provider_name }]);
      } catch (e) {
        if (e?.response?.status === 428) {
          setOpen(false);
          refresh();
          setConnectSheet(true);
        } else {
          setError(errMsg(e, "Your AI didn't answer. Try again."));
        }
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  useEffect(() => {
    if (!user) return undefined;
    const onInk = async (e) => {
      const raw = e.detail?.bbox;
      if (!raw || raw.w + raw.h < MIN_STROKE) return;
      const bbox = markedBBox(e.detail?.points, raw) || raw;
      const { links: ls, isFetched: fetched } = linksRef.current;
      if (fetched && ls.length === 0) {
        setConnectSheet(true);
        return;
      }
      if (!fetched) {
        // first time: make sure we know whether anything is connected
        try {
          const { data } = await api.get("/ai/links");
          if (!(data.links || []).length) {
            setConnectSheet(true);
            return;
          }
        } catch (err) {
          /* fall through: the lookup itself answers 428 when nothing is linked */
        }
      }
      let shot = null;
      const context = collectContext(bbox);
      try {
        shot = await captureRegion(bbox);
      } catch (err) {
        shot = null;
      }
      setPreview(shot?.image || null);
      imageRef.current = shot?.image || null;
      setCtx(context);
      setThread([]);
      setQuestion("");
      setError("");
      setOpen(true);
      if (!shot?.image && !context.texts.length) {
        setError("Couldn't read that part of the screen. Try circling it again.");
        return;
      }
      ask(null, [], shot?.image || null, context);
    };
    window.addEventListener("voiladi:ink", onInk);
    return () => window.removeEventListener("voiladi:ink", onInk);
  }, [user, ask]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [thread, busy]);

  const send = () => {
    const q = question.trim();
    if (!q || busy) return;
    const next = [...thread, { role: "user", text: q }];
    setThread(next);
    setQuestion("");
    ask(q, thread.length ? thread : [{ role: "user", text: "What did I mark? Tell me about it." }], imageRef.current, ctx);
  };

  const retry = () => {
    if (busy) return;
    const lastUser = [...thread].reverse().find((t) => t.role === "user");
    ask(lastUser?.text || null, thread.filter((t) => t !== lastUser), imageRef.current, ctx);
  };

  const first = thread.find((t) => t.role === "assistant");
  const found = [...thread].reverse().find((t) => t.role === "assistant" && t.found)?.found;
  const hasFound = found && (found.people?.length || found.posts?.length || found.topics?.length);
  const providerName = first?.provider_name || active?.name || "AI";
  const providerId = first?.provider || active?.provider || "openai";
  const model = first?.model || active?.model || "";

  return (
    <>
      {/* nothing connected yet */}
      <AD.Root open={connectSheet} onOpenChange={setConnectSheet}>
        <AD.Portal>
          <AD.Overlay className="vo-sheet-overlay" data-ai-ignore="true" />
          <AD.Content className="vo-sheet vo-apple" data-testid="ai-connect-sheet" data-ai-ignore="true" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="vo-sheet-group">
              <div className="vo-sheet-head">
                <AD.Title className="vo-sheet-title">Connect your AI</AD.Title>
                <AD.Description className="vo-sheet-desc">Link your ChatGPT, Claude or Gemini account and the orb will explain anything you circle - and find it in Voiladi.</AD.Description>
              </div>
              <button
                type="button"
                className="vo-sheet-action vo-sheet-ink"
                onClick={() => {
                  setConnectSheet(false);
                  navigate("/settings/ai");
                }}
                data-testid="ai-connect-sheet-go"
              >
                Connect AI
              </button>
            </div>
            <button type="button" className="vo-sheet-cancel" onClick={() => setConnectSheet(false)} data-testid="ai-connect-sheet-cancel">
              Not now
            </button>
          </AD.Content>
        </AD.Portal>
      </AD.Root>

      {/* result drawer */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="vo-ai-drawer mx-auto flex max-h-[82dvh] min-h-[44dvh] max-w-[430px] flex-col rounded-t-[28px] border-0" data-testid="ai-result-sheet" data-ai-ignore="true">
          <div className="flex items-center justify-between px-5 pt-2">
            <div className="flex min-w-0 items-center gap-2">
              <ProviderMark provider={providerId} size={22} />
              <DrawerTitle className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink" data-testid="ai-result-provider">
                {providerName}
                {model && <span className="font-normal text-mute"> · {model}</span>}
              </DrawerTitle>
            </div>
            <DrawerDescription className="sr-only">What your AI says about the part of the screen you circled</DrawerDescription>
          </div>

          <div ref={scrollRef} className="vo-scroll flex-1 px-5 pb-3 pt-3">
            {preview && (
              <div className="mb-4 flex justify-center">
                <img src={preview} alt="The part of the screen you circled" className="max-h-[150px] max-w-full rounded-[16px] object-contain shadow-card" data-testid="ai-result-preview" />
              </div>
            )}

            {thread.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="mb-3 flex justify-end">
                  <span className="max-w-[82%] rounded-[20px] rounded-br-[8px] bg-ink px-4 py-2.5 text-[16px] leading-[21px] tracking-[-0.01em] text-onink" data-testid="ai-user-turn">
                    {t.text}
                  </span>
                </div>
              ) : (
                <p key={i} className="mb-3 whitespace-pre-line text-[17px] leading-[24px] tracking-[-0.01em] text-ink" data-testid="ai-answer">
                  {t.text}
                </p>
              )
            )}

            {busy && (
              <div className="mb-3 space-y-2" data-testid="ai-thinking" aria-busy="true">
                <Skeleton className="h-[16px] w-[92%]" />
                <Skeleton className="h-[16px] w-[76%]" />
                <Skeleton className="h-[16px] w-[58%]" />
              </div>
            )}

            {error && !busy && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-[16px] bg-surface px-4 py-3" role="alert" data-testid="ai-error">
                <span className="text-[15px] leading-[20px] text-ink">{error}</span>
                <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-onink active:opacity-80" onClick={retry} aria-label="Try again" data-testid="ai-retry-button">
                  <RotateCcw className="h-4 w-4" strokeWidth={2.4} />
                </button>
              </div>
            )}

            {hasFound ? (
              <section className="mt-2" data-testid="ai-found">
                <h3 className="text-[13px] font-semibold uppercase leading-none tracking-[0.12em] text-mute">Found in Voiladi</h3>

                {found.people?.length > 0 && (
                  <div className="mt-2" data-testid="ai-found-people">
                    {found.people.map((p, i) => (
                      <PersonRow
                        key={p.id}
                        p={p}
                        last={i === found.people.length - 1}
                        onOpen={(pp) => {
                          setOpen(false);
                          setTimeout(() => setPerson(pp), 220);
                        }}
                      />
                    ))}
                  </div>
                )}

                {found.posts?.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-[3px]" data-testid="ai-found-posts">
                    {found.posts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          navigate(`/p/${p.id}`);
                        }}
                        className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-surface2 focus-visible:outline-none active:opacity-90"
                        data-testid="ai-found-post"
                      >
                        <UserPhoto src={p.image} name={p.caption || ""} size="sm" className="h-full w-full" />
                        {p.kind === "video" && (
                          <span className="absolute right-1.5 top-1.5 text-white" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
                            <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {found.topics?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2" data-testid="ai-found-topics">
                    {found.topics.map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        className="vo-soft-pill h-[40px] px-4 text-[15px] font-medium"
                        onClick={() => {
                          setOpen(false);
                          navigate(`/explore?topic=${encodeURIComponent(t.name)}`);
                        }}
                        data-testid="ai-found-topic"
                      >
                        {t.name}
                        <span className="text-[13px] font-normal text-mute">{t.members}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              first && !busy && <p className="mt-1 text-[14px] text-mute" data-testid="ai-found-empty">Nothing matching in Voiladi yet.</p>
            )}
          </div>

          {/* follow-up composer */}
          <form
            className="flex items-center gap-2 px-4 pb-[calc(12px+var(--safe-bottom))] pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask ${providerName} more…`}
              enterKeyHint="send"
              className="vo-soft-sunken h-[48px] min-w-0 flex-1 rounded-full px-5 text-[16px] tracking-[-0.01em] text-ink outline-none placeholder:text-mute"
              data-testid="ai-followup-input"
            />
            <button type="submit" disabled={!question.trim() || busy} className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-ink text-onink disabled:opacity-40 active:scale-95" style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }} aria-label="Send" data-testid="ai-followup-send">
              {busy ? <Spinner size={18} stroke={2.5} /> : <ArrowUp className="h-5 w-5" strokeWidth={2.6} />}
            </button>
          </form>
        </DrawerContent>
      </Drawer>

      <ProfileSheet profile={person} open={!!person} onOpenChange={(o) => !o && setPerson(null)} showMessage />
    </>
  );
};
