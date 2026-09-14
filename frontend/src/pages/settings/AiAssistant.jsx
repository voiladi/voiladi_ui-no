import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy, ExternalLink } from "lucide-react";
import * as AD from "@radix-ui/react-alert-dialog";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { SoftPageHeader, SoftSectionLabel, SoftCard, SoftRow } from "@/components/SoftUI";
import { ConfirmDialog } from "@/components/Dialogs";
import { Spinner } from "@/components/Loading";
import { useAiLinks } from "@/hooks/useAiLinks";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";

/*
 * Settings > AI Assistant: sign in with your own ChatGPT account so the orb answers on your Plus / Pro plan.
 * Flow (device code): "Sign in with ChatGPT" -> we show a short code -> OpenAI's page opens in the browser -> the user
 * signs in there and types the code -> we poll until OpenAI confirms -> "Connected · email · ChatGPT Plus".
 * Connected: Model row (the account's own Codex catalogue), Sign in again, red Disconnect.
 */

/* Provider mark: small ink tile, like an app icon in iOS Settings. */
export const ProviderMark = ({ provider, size = 30, className = "" }) => {
  const letter = provider === "anthropic" ? "C" : "G";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-[9px] bg-ink font-bold text-onink ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }} aria-hidden="true">
      {provider === "gemini" ? (
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="currentColor" aria-hidden="true">
          <path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z" />
        </svg>
      ) : (
        letter
      )}
    </span>
  );
};

const ChatGptIcon = () => <ProviderMark provider="chatgpt" size={30} />;

const ConnectedValue = ({ link }) =>
  link ? (
    <>
      <span className="inline-flex h-[16px] w-[16px] items-center justify-center rounded-full bg-ink text-onink" aria-hidden="true">
        <Check className="h-[10px] w-[10px]" strokeWidth={3.4} />
      </span>
      Connected
    </>
  ) : (
    "Connect"
  );

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
};

export default function AiAssistant() {
  const navigate = useNavigate();
  const { links, isLoading, refresh } = useAiLinks();
  const link = links.find((l) => l.provider === "chatgpt");
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(null); // {session_id, user_code, verify_url, interval}
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState(""); // "", waiting, denied, expired
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [modelSheet, setModelSheet] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const polling = useRef(false);

  const stopPolling = () => {
    clearInterval(timer.current);
    timer.current = null;
  };

  const close = () => {
    setOpen(false);
    stopPolling();
    setSession(null);
    setStatus("");
    setError("");
  };

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError("");
    setStatus("");
    try {
      const { data } = await api.post("/ai/chatgpt/start");
      setSession(data);
      setStatus("waiting");
      if (await copyText(data.user_code)) setCopied(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setStarting(false);
    }
  };

  // poll while the user is signing in on OpenAI's page (and immediately when they come back to the app)
  useEffect(() => {
    if (!session || status !== "waiting") return undefined;
    const poll = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const { data } = await api.get(`/ai/chatgpt/poll/${session.session_id}`);
        if (data.status === "connected") {
          stopPolling();
          setStatus("");
          setSession(null);
          await refresh();
          notice(`ChatGPT connected${data.link?.email ? ` · ${data.link.email}` : ""}`);
        } else if (data.status === "denied" || data.status === "expired") {
          stopPolling();
          setStatus(data.status);
        }
      } catch (e) {
        /* transient - keep polling */
      } finally {
        polling.current = false;
      }
    };
    const every = Math.max(3, Number(session.interval) || 5) * 1000;
    timer.current = setInterval(poll, every);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.session_id, status]);

  const pickModel = async (model) => {
    setModelSheet(false);
    if (!link || model === link.model) return;
    try {
      await api.put("/ai/links/chatgpt", { model });
      refresh();
    } catch (e) {
      notice(errMsg(e));
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.delete("/ai/links/chatgpt");
      await refresh();
      setConfirmDisconnect(false);
      notice("ChatGPT disconnected");
      close();
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const codeField = session && (
    <div className="space-y-3" data-testid="ai-device-code-block">
      <button
        type="button"
        onClick={async () => {
          if (await copyText(session.user_code)) {
            setCopied(true);
            notice("Code copied");
          }
        }}
        className="vo-soft-sunken flex h-[64px] w-full items-center justify-between rounded-[18px] px-5 focus-visible:outline-none active:opacity-80"
        data-testid="ai-device-code"
        aria-label="Copy the sign-in code"
      >
        <span className="text-[28px] font-bold tracking-[0.12em] text-ink" data-testid="ai-device-code-text">
          {session.user_code}
        </span>
        <span className="flex items-center gap-1.5 text-[14px] font-semibold text-mute">
          {copied ? <Check className="h-[18px] w-[18px]" strokeWidth={2.4} /> : <Copy className="h-[18px] w-[18px]" strokeWidth={2} />}
          {copied ? "Copied" : "Copy"}
        </span>
      </button>
      <a href={session.verify_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink text-[17px] font-semibold text-onink active:scale-[0.98]" style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }} data-testid="ai-open-chatgpt-link">
        <ExternalLink className="h-[20px] w-[20px]" strokeWidth={2.2} />
        Open ChatGPT to enter the code
      </a>
      {status === "waiting" && (
        <p className="flex items-center justify-center gap-2 text-[14px] text-mute" data-testid="ai-device-waiting" aria-busy="true">
          <Spinner size={14} stroke={2.2} className="text-mute" /> Waiting for you to sign in… come back here when it says Done.
        </p>
      )}
    </div>
  );

  return (
    <div className="vo-neu-page flex min-h-full flex-col px-4 pb-10" data-testid="ai-assistant-page">
      <SoftPageHeader title="AI Assistant" onBack={() => navigate("/settings")} backTestId="ai-assistant-back-button" />

      <SoftCard className="mt-3 px-4 py-3.5" testId="ai-assistant-intro">
        <span className="block text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-mute">How it works</span>
        <p className="mt-1.5 text-[15px] leading-[20px] tracking-[-0.01em] text-ink">
          Hold the orb on the tab bar, pull it up and circle anything on your screen. Your ChatGPT explains it and finds matching people, posts and communities in Voiladi.
        </p>
        <p className="mt-1.5 text-[13px] leading-[17px] text-mute">Sign in once with your ChatGPT account. Answers run on your own plan - Voiladi never sees your password.</p>
      </SoftCard>

      <div className="mt-5 space-y-5">
        <section>
          <SoftSectionLabel>Account</SoftSectionLabel>
          <SoftCard className="overflow-hidden" testId="ai-providers-card">
            <SoftRow icon={ChatGptIcon} label="ChatGPT" value={isLoading ? "" : <ConnectedValue link={link} />} onClick={() => setOpen(true)} testId="ai-provider-chatgpt-row" last />
          </SoftCard>
          {link && (
            <p className="mt-2 px-4 text-[13px] leading-[17px] text-mute" data-testid="ai-provider-chatgpt-sub">
              {link.email}
              {link.plan_label ? ` · ${link.plan_label}` : ""}
              {link.model ? ` · ${link.model}` : ""}
            </p>
          )}
        </section>
      </div>

      {/* ChatGPT drawer */}
      <Drawer open={open} onOpenChange={(o) => !o && close()}>
        <DrawerContent className="mx-auto max-h-[88dvh] max-w-[430px] rounded-t-[28px] border-0 bg-canvas" data-testid="ai-provider-drawer">
          <div className="vo-scroll px-5 pb-[calc(20px+var(--safe-bottom))] pt-3">
            <div className="flex items-center gap-3">
              <ProviderMark provider="chatgpt" size={44} />
              <div className="min-w-0">
                <DrawerTitle className="text-[22px] font-bold leading-[26px] tracking-[-0.02em] text-ink">{link ? "ChatGPT" : "Connect ChatGPT"}</DrawerTitle>
                <DrawerDescription className="truncate text-[14px] leading-[18px] text-mute" data-testid="ai-drawer-sub">
                  {link ? `Connected · ${link.email || link.hint}${link.plan_label ? ` · ${link.plan_label}` : ""}` : "Uses your own ChatGPT account · Plus or Pro"}
                </DrawerDescription>
              </div>
            </div>

            {link && !session ? (
              <div className="mt-5 space-y-4">
                <SoftCard className="overflow-hidden" testId="ai-link-card">
                  <SoftRow label="Model" value={link.model} onClick={() => setModelSheet(true)} testId="ai-model-row" />
                  <SoftRow label="Sign in again" onClick={start} testId="ai-reconnect-row" last />
                </SoftCard>
                {error && (
                  <p className="px-1 text-[14px] font-medium text-red" role="alert" data-testid="ai-connect-error">
                    {error}
                  </p>
                )}
                <p className="px-1 text-[13px] leading-[17px] text-mute">Disconnecting removes your ChatGPT sign-in from Voiladi. Nothing changes on your ChatGPT account.</p>
                <button type="button" onClick={() => setConfirmDisconnect(true)} className="inline-flex h-[52px] w-full items-center justify-center rounded-full text-[17px] font-semibold text-red active:opacity-70" data-testid="ai-disconnect-button">
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <SoftCard className="px-4 py-3.5" testId="ai-connect-steps">
                  <ol className="space-y-2.5 text-[15px] leading-[20px] tracking-[-0.01em] text-ink">
                    <li className="flex gap-3">
                      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-onink">1</span>
                      <span>Tap Sign in with ChatGPT. You'll get a short code.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-onink">2</span>
                      <span>OpenAI's page opens - sign in to your ChatGPT account, enter the code and allow access.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-onink">3</span>
                      <span>Come back here. You're connected.</span>
                    </li>
                  </ol>
                </SoftCard>

                {codeField}

                {(status === "denied" || status === "expired") && (
                  <p className="px-1 text-[14px] font-medium text-red" role="alert" data-testid="ai-connect-error">
                    {status === "denied" ? "OpenAI didn't approve the sign-in. Try again." : "That code expired. Start again."}
                  </p>
                )}
                {error && (
                  <p className="px-1 text-[14px] font-medium text-red" role="alert" data-testid="ai-connect-error">
                    {error}
                  </p>
                )}

                {!session && (
                  <button type="button" onClick={start} disabled={starting} aria-busy={starting} className="inline-flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[17px] font-semibold text-onink active:scale-[0.98] disabled:opacity-40" style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }} data-testid="ai-signin-button">
                    {starting ? <Spinner size={20} stroke={2.5} /> : "Sign in with ChatGPT"}
                  </button>
                )}
                {session && (
                  <button
                    type="button"
                    onClick={() => {
                      stopPolling();
                      setSession(null);
                      setStatus("");
                    }}
                    className="inline-flex h-[48px] w-full items-center justify-center rounded-full text-[16px] font-semibold text-mute active:opacity-70"
                    data-testid="ai-signin-cancel"
                  >
                    Cancel
                  </button>
                )}
                <p className="px-1 text-center text-[13px] leading-[17px] text-mute">
                  Answers count towards your ChatGPT plan's usage. Sign-in works through OpenAI's Codex login, which OpenAI hasn't made an official program for other apps yet.
                </p>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Model picker (iOS action sheet) */}
      <AD.Root open={modelSheet} onOpenChange={setModelSheet}>
        <AD.Portal>
          <AD.Overlay className="vo-sheet-overlay" />
          <AD.Content className="vo-sheet vo-apple" data-testid="ai-model-sheet" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="vo-sheet-group">
              <div className="vo-sheet-head">
                <AD.Title className="vo-sheet-title">Model</AD.Title>
                <AD.Description className="vo-sheet-desc">Models available on your ChatGPT plan.</AD.Description>
              </div>
              <div className="vo-sheet-list max-h-[52dvh] overflow-y-auto" role="radiogroup">
                {(link?.models || []).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={link?.model === m} onClick={() => pickModel(m)} className="vo-sheet-option" data-testid="ai-model-option">
                    <span className="flex-1 truncate">{m}</span>
                    {link?.model === m && <Check className="h-[18px] w-[18px] shrink-0" strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="vo-sheet-cancel" onClick={() => setModelSheet(false)} data-testid="ai-model-cancel">
              Cancel
            </button>
          </AD.Content>
        </AD.Portal>
      </AD.Root>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Disconnect ChatGPT?"
        description="Your ChatGPT sign-in is removed from Voiladi. You can connect again anytime."
        confirmText="Disconnect"
        danger
        loading={busy}
        onConfirm={disconnect}
        testId="ai-disconnect-dialog"
      />
    </div>
  );
}
