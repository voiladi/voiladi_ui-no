import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Eye, EyeOff, ExternalLink } from "lucide-react";
import * as AD from "@radix-ui/react-alert-dialog";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { SoftPageHeader, SoftSectionLabel, SoftCard, SoftRow } from "@/components/SoftUI";
import { ConfirmDialog } from "@/components/Dialogs";
import { Spinner } from "@/components/Loading";
import { useAiLinks } from "@/hooks/useAiLinks";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";

/*
 * Settings > AI Assistant: connect your own ChatGPT / Claude / Gemini account so the orb can search with it.
 * Flow per provider (Drawer): "Open <company>" -> sign in there and create a key -> paste -> Connect (verified live).
 * Connected: model picker (the account's own models), "Use for the orb", Disconnect. Same soft-UI grouped lists as Settings.
 */

/* Provider mark: small ink tile with the first letter, like an app icon in iOS Settings. */
export const ProviderMark = ({ provider, size = 30, className = "" }) => {
  const letter = provider === "openai" ? "G" : provider === "anthropic" ? "C" : "◆";
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

const ICONS = {
  openai: () => <ProviderMark provider="openai" size={30} />,
  anthropic: () => <ProviderMark provider="anthropic" size={30} />,
  gemini: () => <ProviderMark provider="gemini" size={30} />,
};
const ProviderIcon = (provider) => ICONS[provider] || ICONS.openai;

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

export default function AiAssistant() {
  const navigate = useNavigate();
  const { links, active, providers, isLoading, refresh } = useAiLinks();
  const [open, setOpen] = useState(null); // provider id
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modelSheet, setModelSheet] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const meta = providers.find((p) => p.id === open);
  const link = links.find((l) => l.provider === open);

  const close = () => {
    setOpen(null);
    setKey("");
    setShow(false);
    setError("");
  };

  const connect = async () => {
    if (!key.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/ai/links", { provider: open, api_key: key.trim() });
      await refresh();
      notice(`${meta?.name} connected`);
      setKey("");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const pickModel = async (model) => {
    setModelSheet(false);
    if (!link || model === link.model) return;
    try {
      await api.put(`/ai/links/${open}`, { model });
      refresh();
    } catch (e) {
      notice(errMsg(e));
    }
  };

  const makeActive = async () => {
    if (!link || active?.provider === open) return;
    try {
      await api.put(`/ai/links/${open}`, { active: true });
      refresh();
      notice(`The orb now uses ${meta?.name}`);
    } catch (e) {
      notice(errMsg(e));
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.delete(`/ai/links/${open}`);
      await refresh();
      setConfirmDisconnect(false);
      notice(`${meta?.name} disconnected`);
      close();
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const orderedProviders = providers.length ? providers : [
    { id: "openai", name: "ChatGPT", company: "OpenAI" },
    { id: "anthropic", name: "Claude", company: "Anthropic" },
    { id: "gemini", name: "Gemini", company: "Google" },
  ];

  return (
    <div className="vo-neu-page flex min-h-full flex-col px-4 pb-10" data-testid="ai-assistant-page">
      <SoftPageHeader title="AI Assistant" onBack={() => navigate("/settings")} backTestId="ai-assistant-back-button" />

      <SoftCard className="mt-3 px-4 py-3.5" testId="ai-assistant-intro">
        <span className="block text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-mute">How it works</span>
        <p className="mt-1.5 text-[15px] leading-[20px] tracking-[-0.01em] text-ink">
          Hold the orb on the tab bar, pull it up and circle anything on your screen. Your own AI explains it and finds matching people, posts and communities in Voiladi.
        </p>
        <p className="mt-1.5 text-[13px] leading-[17px] text-mute">Your account, your usage. The key stays encrypted on our side and is never shown again.</p>
      </SoftCard>

      <div className="mt-5 space-y-5">
        <section>
          <SoftSectionLabel>Accounts</SoftSectionLabel>
          <SoftCard className="overflow-hidden" testId="ai-providers-card">
            {orderedProviders.map((p, i) => {
              const l = links.find((x) => x.provider === p.id);
              return (
                <SoftRow
                  key={p.id}
                  icon={ProviderIcon(p.id)}
                  label={p.name}
                  value={isLoading ? "" : <ConnectedValue link={l} />}
                  onClick={() => setOpen(p.id)}
                  testId={`ai-provider-${p.id}-row`}
                  last={i === orderedProviders.length - 1}
                />
              );
            })}
          </SoftCard>
        </section>

        {links.length > 0 && (
          <section>
            <SoftSectionLabel>The orb uses</SoftSectionLabel>
            <SoftCard className="overflow-hidden" testId="ai-active-card">
              {links.map((l, i) => (
                <SoftRow
                  key={l.provider}
                  icon={ProviderIcon(l.provider)}
                  label={l.name}
                  value={l.model}
                  onClick={async () => {
                    if (active?.provider === l.provider) return;
                    try {
                      await api.put(`/ai/links/${l.provider}`, { active: true });
                      refresh();
                    } catch (e) {
                      notice(errMsg(e));
                    }
                  }}
                  right={active?.provider === l.provider ? <Check className="h-[20px] w-[20px] shrink-0 text-ink" strokeWidth={2.5} data-testid={`ai-active-${l.provider}`} /> : <span className="h-[20px] w-[20px] shrink-0" />}
                  testId={`ai-active-${l.provider}-row`}
                  last={i === links.length - 1}
                />
              ))}
            </SoftCard>
          </section>
        )}
      </div>

      {/* Per-provider drawer */}
      <Drawer open={!!open} onOpenChange={(o) => !o && close()}>
        <DrawerContent className="mx-auto max-h-[88dvh] max-w-[430px] rounded-t-[28px] border-0 bg-canvas" data-testid="ai-provider-drawer">
          {meta && (
            <div className="vo-scroll px-5 pb-[calc(20px+var(--safe-bottom))] pt-3">
              <div className="flex items-center gap-3">
                <ProviderMark provider={meta.id} size={44} />
                <div className="min-w-0">
                  <DrawerTitle className="text-[22px] font-bold leading-[26px] tracking-[-0.02em] text-ink">{link ? meta.name : `Connect ${meta.name}`}</DrawerTitle>
                  <DrawerDescription className="text-[14px] leading-[18px] text-mute">{link ? `Connected · key ${link.hint}` : `Uses your own ${meta.company} account`}</DrawerDescription>
                </div>
              </div>

              {link ? (
                <div className="mt-5 space-y-4">
                  <SoftCard className="overflow-hidden" testId="ai-link-card">
                    <SoftRow label="Model" value={link.model} onClick={() => setModelSheet(true)} testId="ai-model-row" />
                    <SoftRow
                      label="Use for the orb"
                      onClick={makeActive}
                      right={active?.provider === open ? <Check className="h-[20px] w-[20px] shrink-0 text-ink" strokeWidth={2.5} /> : <ChevronRight className="h-[18px] w-[18px] shrink-0 text-mute" strokeWidth={2} />}
                      testId="ai-use-row"
                      last
                    />
                  </SoftCard>
                  <p className="px-1 text-[13px] leading-[17px] text-mute">Paste a new key to replace the current one. Disconnecting removes the key from Voiladi.</p>
                  <div className="relative">
                    <input
                      type={show ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Paste a new key (optional)"
                      value={key}
                      onChange={(e) => {
                        setKey(e.target.value);
                        setError("");
                      }}
                      className={`vo-soft-sunken h-[52px] w-full rounded-[16px] pl-4 pr-12 text-[16px] tracking-[-0.01em] text-ink outline-none placeholder:text-mute ${error ? "ring-1.5 ring-red" : ""}`}
                      data-testid="ai-key-input"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-mute" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide key" : "Show key"} data-testid="ai-key-toggle">
                      {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {error && (
                    <p className="px-1 text-[14px] font-medium text-red" role="alert" data-testid="ai-connect-error">
                      {error}
                    </p>
                  )}
                  {key.trim() && (
                    <button type="button" onClick={connect} disabled={busy} aria-busy={busy} className="inline-flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[17px] font-semibold text-onink active:scale-[0.98] disabled:opacity-40" style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }} data-testid="ai-reconnect-button">
                      {busy ? <Spinner size={20} stroke={2.5} /> : "Update key"}
                    </button>
                  )}
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
                        <span>
                          Sign in to your {meta.company} account and create a key.
                        </span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-onink">2</span>
                        <span>Copy it, come back and paste it below.</span>
                      </li>
                    </ol>
                  </SoftCard>
                  <a
                    href={meta.keys_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vo-soft-pill h-[52px] w-full text-[17px]"
                    data-testid="ai-open-provider-link"
                  >
                    <ExternalLink className="h-[20px] w-[20px]" strokeWidth={2.2} />
                    Open {meta.company}
                  </a>
                  <div className="relative">
                    <input
                      type={show ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={`Paste your ${meta.name} key`}
                      value={key}
                      onChange={(e) => {
                        setKey(e.target.value);
                        setError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && connect()}
                      className={`vo-soft-sunken h-[52px] w-full rounded-[16px] pl-4 pr-12 text-[16px] tracking-[-0.01em] text-ink outline-none placeholder:text-mute ${error ? "ring-1.5 ring-red" : ""}`}
                      data-testid="ai-key-input"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-mute" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide key" : "Show key"} data-testid="ai-key-toggle">
                      {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {error && (
                    <p className="px-1 text-[14px] font-medium text-red" role="alert" data-testid="ai-connect-error">
                      {error}
                    </p>
                  )}
                  <button type="button" onClick={connect} disabled={!key.trim() || busy} aria-busy={busy} className="inline-flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[17px] font-semibold text-onink active:scale-[0.98] disabled:opacity-40" style={{ transitionProperty: "transform, opacity", transitionDuration: "120ms" }} data-testid="ai-connect-button">
                    {busy ? <Spinner size={20} stroke={2.5} /> : "Connect"}
                  </button>
                  <p className="px-1 text-center text-[13px] leading-[17px] text-mute">Usage is billed to your {meta.company} account. We check the key once, then encrypt it.</p>
                </div>
              )}
            </div>
          )}
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
                <AD.Description className="vo-sheet-desc">Models available on your {meta?.company} account.</AD.Description>
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
        title={`Disconnect ${meta?.name}?`}
        description="The key is deleted from Voiladi. You can connect again anytime."
        confirmText="Disconnect"
        danger
        loading={busy}
        onConfirm={disconnect}
        testId="ai-disconnect-dialog"
      />
    </div>
  );
}
