import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, ExternalLink, Settings } from "lucide-react";
import * as AD from "@radix-ui/react-alert-dialog";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { SoftPageHeader, SoftSectionLabel } from "@/components/SoftUI";
import { ConfirmDialog } from "@/components/Dialogs";
import { Spinner } from "@/components/Loading";
import { useAiLinks } from "@/hooks/useAiLinks";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";

/*
 * Settings > AI Assistant - built from the owner's three mockups:
 *  1. Not connected: ACCOUNT card "ChatGPT / Not connected >" -> white sheet "Connect ChatGPT" with 3 numbered steps,
 *     black "Sign in with ChatGPT", "Not now", "Uses your ChatGPT plan."
 *  2. Signing in: same sheet, steps reworded, grey code block "DD1L-JYRDD  ✓ Copied", black "Open ChatGPT to enter the code",
 *     ring spinner + "Waiting for you to sign in / Come back here when it's done.", "Cancel".
 *  3. Connected: bordered card (icon, "ChatGPT ✓", email, "● Connected" pill, "Manage account >") and a big grey
 *     "Disconnect" pill pinned to the bottom.
 * Device-code flow: start -> code -> OpenAI page -> poll until connected.
 */

/* OpenAI mark on an ink tile (the ChatGPT app icon). Used here and in the orb result drawer. */
export const ProviderMark = ({ provider = "chatgpt", size = 30, className = "" }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center bg-ink text-onink ${className}`}
    style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }}
    aria-hidden="true"
    data-provider={provider}
  >
    <svg viewBox="0 0 24 24" width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} fill="currentColor" aria-hidden="true">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  </span>
);

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
};

/* One numbered row of the "how it works" card. */
const Step = ({ n, title, sub, last }) => (
  <li className={`flex items-center gap-[22px] py-[19px] ${last ? "" : "border-b border-line"}`} data-testid={`ai-step-${n}`}>
    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-surface text-[17px] font-medium text-ink">{n}</span>
    <span className="min-w-0">
      <span className="block text-[20px] font-semibold leading-[25px] tracking-[-0.02em] text-ink">{title}</span>
      <span className="mt-[3px] block whitespace-nowrap text-[16.5px] leading-[22px] tracking-[-0.02em] text-mute">{sub}</span>
    </span>
  </li>
);

const INK_BTN = "inline-flex h-[52px] w-full items-center justify-center gap-4 rounded-full bg-ink text-[20px] font-semibold tracking-[-0.01em] text-onink active:scale-[0.98] disabled:opacity-40";
const BTN_MOTION = { transitionProperty: "transform, opacity", transitionDuration: "120ms" };

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
  const [manageSheet, setManageSheet] = useState(false);
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
    setCopied(false);
  };

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError("");
    setStatus("");
    setOpen(true);
    try {
      const { data } = await api.post("/ai/chatgpt/start");
      setSession(data);
      setStatus("waiting");
      setCopied(await copyText(data.user_code));
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
          setOpen(false);
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

  const failure = error || (status === "denied" ? "OpenAI didn't approve the sign-in. Try again." : status === "expired" ? "That code expired. Start again." : "");

  return (
    <div className="vo-neu-page flex min-h-full flex-col px-5 pb-[calc(24px+var(--safe-bottom))]" data-testid="ai-assistant-page">
      <SoftPageHeader title="AI Assistant" onBack={() => navigate("/settings")} backTestId="ai-assistant-back-button" />

      {link ? (
        /* ---------- connected ---------- */
        <>
          <section className="mt-6 rounded-[24px] border border-line bg-bg px-[18px] pt-[18px] shadow-card" data-testid="ai-connected-card">
            <div className="flex items-center gap-[16px] pb-[18px]">
              <ProviderMark provider="chatgpt" size={54} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-[22px] font-bold leading-[26px] tracking-[-0.02em] text-ink">ChatGPT</span>
                    <span className="inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-ink text-onink" aria-label="Verified" data-testid="ai-connected-badge">
                      <Check className="h-[12px] w-[12px]" strokeWidth={3.4} />
                    </span>
                  </span>
                  <span className="inline-flex h-[30px] shrink-0 items-center gap-[7px] rounded-full bg-surface pl-3 pr-3.5 text-[15px] font-medium tracking-[-0.01em] text-ink" data-testid="ai-connected-pill">
                    <span className="h-[9px] w-[9px] rounded-full bg-[#34C759]" aria-hidden="true" />
                    Connected
                  </span>
                </div>
                <p className="mt-[3px] truncate text-[16px] leading-[21px] tracking-[-0.02em] text-mute" data-testid="ai-connected-email">
                  {link.email || link.hint}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setManageSheet(true)} className="flex h-[60px] w-full items-center gap-[14px] border-t border-line text-left active:opacity-70 focus-visible:outline-none" data-testid="ai-manage-row">
              <span className="flex w-[40px] shrink-0 items-center justify-center text-ink">
                <Settings className="h-[24px] w-[24px]" strokeWidth={1.8} />
              </span>
              <span className="flex-1 text-[18px] font-medium tracking-[-0.01em] text-ink">Manage account</span>
              <ChevronRight className="h-[20px] w-[20px] shrink-0 text-ink" strokeWidth={2.2} />
            </button>
          </section>

          <div className="flex-1" />
          <button type="button" onClick={() => setConfirmDisconnect(true)} className="inline-flex h-[60px] w-full items-center justify-center rounded-full bg-surface2 text-[20px] font-semibold tracking-[-0.01em] text-ink active:scale-[0.98]" style={BTN_MOTION} data-testid="ai-disconnect-button">
            Disconnect
          </button>
        </>
      ) : (
        /* ---------- not connected ---------- */
        <section className="mt-7">
          <SoftSectionLabel className="px-1.5 text-[13px] tracking-[0.06em]">Account</SoftSectionLabel>
          <button type="button" onClick={() => setOpen(true)} className="flex h-[76px] w-full items-center gap-4 rounded-[24px] bg-surface2 px-4 text-left active:opacity-80 focus-visible:outline-none" data-testid="ai-provider-chatgpt-row">
            <ProviderMark provider="chatgpt" size={48} />
            <span className="min-w-0 flex-1">
              <span className="block text-[20px] font-medium leading-[24px] tracking-[-0.01em] text-ink">ChatGPT</span>
              <span className="mt-[2px] block text-[17px] leading-[21px] tracking-[-0.01em] text-mute" data-testid="ai-provider-chatgpt-row-value">
                {isLoading ? "" : "Not connected"}
              </span>
            </span>
            <ChevronRight className="h-[20px] w-[20px] shrink-0 text-mute" strokeWidth={2.2} />
          </button>
        </section>
      )}

      {/* ---------- Connect ChatGPT sheet ---------- */}
      <Drawer open={open} onOpenChange={(o) => !o && close()}>
        <DrawerContent className="mx-auto max-h-[92dvh] max-w-[430px] rounded-t-[30px] border-0 bg-bg [&>div:first-child]:hidden" data-testid="ai-provider-drawer">
          <div className="mx-auto mt-3 h-[5px] w-12 shrink-0 rounded-full bg-surface2" aria-hidden="true" />
          <div className="vo-scroll px-5 pb-[calc(16px+var(--safe-bottom))] pt-7">
            <div className="flex items-center gap-[18px]">
              <ProviderMark provider="chatgpt" size={58} />
              <div className="min-w-0">
                <DrawerTitle className="text-[30px] font-bold leading-[34px] tracking-[-0.025em] text-ink">Connect ChatGPT</DrawerTitle>
                <DrawerDescription className="mt-[2px] text-[19px] leading-[24px] tracking-[-0.01em] text-mute" data-testid="ai-drawer-sub">
                  Use your own ChatGPT account.
                </DrawerDescription>
              </div>
            </div>

            <ol className="mt-6 rounded-[24px] border border-line bg-bg px-5 shadow-card" data-testid="ai-connect-steps">
              {session ? (
                <>
                  <Step n={1} title="Tap Sign in with ChatGPT" sub="You'll get a short code." />
                  <Step n={2} title="Sign in and approve access" sub="Enter the code and allow access." />
                  <Step n={3} title="Come back here" sub="You're connected." last />
                </>
              ) : (
                <>
                  <Step n={1} title="Tap Sign in with ChatGPT" sub="You'll be taken to OpenAI to sign in." />
                  <Step n={2} title="Sign in and approve access" sub="Enter the code and allow access." />
                  <Step n={3} title="Come back to continue" sub="You'll be connected and ready to use." last />
                </>
              )}
            </ol>

            {session ? (
              <div data-testid="ai-device-code-block">
                <button
                  type="button"
                  onClick={async () => {
                    if (await copyText(session.user_code)) {
                      setCopied(true);
                      notice("Code copied");
                    }
                  }}
                  className="mt-4 flex h-[58px] w-full items-center justify-between rounded-[20px] bg-surface px-5 focus-visible:outline-none active:opacity-80"
                  data-testid="ai-device-code"
                  aria-label="Copy the sign-in code"
                >
                  <span className="text-[30px] font-bold leading-none tracking-[0.01em] text-ink" data-testid="ai-device-code-text">
                    {session.user_code}
                  </span>
                  <span className="flex items-center gap-2 text-[17px] tracking-[-0.01em] text-mute" data-testid="ai-device-code-copy">
                    {copied && <Check className="h-[20px] w-[20px]" strokeWidth={2.4} />}
                    {copied ? "Copied" : "Copy"}
                  </span>
                </button>

                <a href={session.verify_url} target="_blank" rel="noopener noreferrer" className={`${INK_BTN} mt-3`} style={BTN_MOTION} data-testid="ai-open-chatgpt-link">
                  <ExternalLink className="h-[22px] w-[22px]" strokeWidth={2.2} />
                  Open ChatGPT to enter the code
                </a>

                {status === "waiting" && (
                  <div className="mt-5 flex items-center justify-center gap-4" data-testid="ai-device-waiting" aria-busy="true">
                    <Spinner size={32} stroke={3} className="text-mute" />
                    <div>
                      <p className="text-[19px] font-semibold leading-[23px] tracking-[-0.02em] text-ink">Waiting for you to sign in</p>
                      <p className="mt-[2px] text-[16px] leading-[20px] tracking-[-0.01em] text-mute">Come back here when it's done.</p>
                    </div>
                  </div>
                )}
                {failure && (
                  <p className="mt-4 text-center text-[15px] font-medium text-red" role="alert" data-testid="ai-connect-error">
                    {failure}
                  </p>
                )}

                <button type="button" onClick={close} className="mt-5 inline-flex h-[48px] w-full items-center justify-center text-[20px] font-semibold tracking-[-0.01em] text-ink active:opacity-60" data-testid="ai-signin-cancel">
                  Cancel
                </button>
              </div>
            ) : (
              <div>
                {failure && (
                  <p className="mt-4 text-center text-[15px] font-medium text-red" role="alert" data-testid="ai-connect-error">
                    {failure}
                  </p>
                )}
                <button type="button" onClick={start} disabled={starting} aria-busy={starting} className={`${INK_BTN} mt-8`} style={BTN_MOTION} data-testid="ai-signin-button">
                  {starting ? <Spinner size={22} stroke={2.5} /> : "Sign in with ChatGPT"}
                </button>
                <button type="button" onClick={close} className="mt-4 inline-flex h-[48px] w-full items-center justify-center text-[20px] font-semibold tracking-[-0.01em] text-ink active:opacity-60" data-testid="ai-not-now-button">
                  Not now
                </button>
              </div>
            )}

            <p className="mt-3 text-center text-[17px] leading-[22px] tracking-[-0.01em] text-mute" data-testid="ai-plan-note">
              Uses your ChatGPT plan.
            </p>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ---------- Manage account (iOS action sheet) ---------- */}
      <AD.Root open={manageSheet} onOpenChange={setManageSheet}>
        <AD.Portal>
          <AD.Overlay className="vo-sheet-overlay" />
          <AD.Content className="vo-sheet vo-apple" data-testid="ai-manage-sheet" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="vo-sheet-group">
              <div className="vo-sheet-head">
                <AD.Title className="vo-sheet-title">Manage account</AD.Title>
                <AD.Description className="vo-sheet-desc">
                  {link?.email || link?.hint}
                  {link?.plan_label ? ` · ${link.plan_label}` : ""}
                </AD.Description>
              </div>
              <button
                type="button"
                className="vo-sheet-action"
                onClick={() => {
                  setManageSheet(false);
                  setTimeout(() => setModelSheet(true), 180);
                }}
                data-testid="ai-manage-model"
              >
                Model{link?.model ? ` · ${link.model}` : ""}
              </button>
              <button
                type="button"
                className="vo-sheet-action"
                onClick={() => {
                  setManageSheet(false);
                  setTimeout(start, 180);
                }}
                data-testid="ai-manage-reconnect"
              >
                Sign in again
              </button>
              <a href="https://chatgpt.com/#settings" target="_blank" rel="noopener noreferrer" className="vo-sheet-action" onClick={() => setManageSheet(false)} data-testid="ai-manage-open-chatgpt">
                Open ChatGPT settings
              </a>
            </div>
            <button type="button" className="vo-sheet-cancel" onClick={() => setManageSheet(false)} data-testid="ai-manage-cancel">
              Cancel
            </button>
          </AD.Content>
        </AD.Portal>
      </AD.Root>

      {/* ---------- Model picker (iOS action sheet) ---------- */}
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
