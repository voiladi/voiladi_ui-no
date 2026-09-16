import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, BadgeCheck, User, Lock, Bell, SlidersHorizontal, Globe, CircleHelp, FileText, Info, Check, Bookmark, SunMoon, Orbit } from "lucide-react";
import * as AD from "@radix-ui/react-alert-dialog";
import { useAuth } from "@/context/AuthContext";
import { useTheme, THEME_MODES } from "@/hooks/useTheme";
import { SoftPageHeader, SoftSectionLabel, SoftCard, SoftRow } from "@/components/SoftUI";
import { ConfirmDialog } from "@/components/Dialogs";
import { formatPhone } from "@/lib/phone";
import { useAiLinks } from "@/hooks/useAiLinks";

/* Settings, Instagram-style grouped lists on the soft canvas. Account details (email / phone / verification) live at the top. */

export const verificationLabel = (user) => {
  if (user?.verified) return "Verified";
  const s = user?.verification?.status || "none";
  if (s === "pending") return "In review";
  if (s === "rejected") return "Not approved";
  return "Not verified";
};

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const [confirm, setConfirm] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const modeLabel = THEME_MODES.find((m) => m.value === mode)?.label || "System";
  const ai = useAiLinks();
  const aiLabel = ai.active ? ai.active.name : ai.isFetched ? "Off" : "";

  const verifiedValue = user?.verified ? (
    <>
      <span className="inline-flex h-[16px] w-[16px] items-center justify-center rounded-full bg-ink text-onink" aria-hidden="true">
        <Check className="h-[10px] w-[10px]" strokeWidth={3.4} />
      </span>
      Verified
    </>
  ) : (
    verificationLabel(user)
  );

  return (
    <div className="vo-neu-page flex min-h-full flex-col px-4 pb-10" data-testid="settings-page">
      <SoftPageHeader title="Settings" onBack={() => navigate("/profile")} backTestId="settings-back-button" />

      <div className="mt-3 space-y-5">
        <section>
          <SoftSectionLabel>Account</SoftSectionLabel>
          <SoftCard className="overflow-hidden" testId="settings-account-card">
            <SoftRow icon={Mail} label="Email" value={user?.email || "Add"} onClick={() => navigate("/settings/email")} testId="settings-email-row" />
            <SoftRow icon={Phone} label="Phone" value={user?.phone ? formatPhone(user.phone) : "Add"} onClick={() => navigate("/settings/phone")} testId="settings-phone-row" />
            <SoftRow icon={BadgeCheck} label="Verification" value={verifiedValue} onClick={() => navigate("/settings/verification")} testId="settings-verification-row" last />
          </SoftCard>
        </section>

        <section>
          <SoftSectionLabel>Profile</SoftSectionLabel>
          <SoftCard className="overflow-hidden" testId="settings-profile-card">
            <SoftRow icon={User} label="Account" onClick={() => navigate("/profile/edit")} testId="settings-account-row" />
            <SoftRow icon={Bookmark} label="Saved" onClick={() => navigate("/saved")} testId="settings-saved-row" />
            <SoftRow icon={SlidersHorizontal} label="Preferences" onClick={() => navigate("/filters")} testId="settings-preferences-row" />
            <SoftRow icon={Bell} label="Notifications" onClick={() => navigate("/settings/notifications")} testId="settings-notifications-row" />
            <SoftRow icon={Lock} label="Privacy & Safety" onClick={() => navigate("/legal/safety")} testId="settings-privacy-row" last />
          </SoftCard>
        </section>

        <section>
          <SoftSectionLabel>App</SoftSectionLabel>
          <SoftCard className="overflow-hidden" testId="settings-app-card">
            <SoftRow icon={Orbit} label="AI Assistant" value={aiLabel} onClick={() => navigate("/settings/ai")} testId="settings-ai-row" />
            <SoftRow icon={Globe} label="Language" value="English" testId="settings-language-row" />
            <SoftRow icon={SunMoon} label="Appearance" value={modeLabel} onClick={() => setAppearance(true)} testId="settings-appearance-row" last />
          </SoftCard>
        </section>

        <section>
          <SoftSectionLabel>Support</SoftSectionLabel>
          <SoftCard className="overflow-hidden" testId="settings-support-card">
            <SoftRow icon={CircleHelp} label="Help & Support" onClick={() => navigate("/legal/help")} testId="settings-help-row" />
            <SoftRow icon={FileText} label="Terms of Service" onClick={() => navigate("/legal/terms")} testId="settings-terms-row" />
            <SoftRow icon={Info} label="About VOILADI" onClick={() => navigate("/legal/about")} testId="settings-about-row" last />
          </SoftCard>
        </section>

        <div className="pt-2">
          <SoftCard as="button" type="button" className="flex h-[54px] w-full items-center justify-center text-[17px] font-semibold text-ink focus-visible:outline-none active:opacity-80" onClick={() => setConfirm(true)} testId="profile-logout-button">
            Log Out
          </SoftCard>
        </div>
      </div>

      {/* Appearance: System / Light / Dark (iOS action sheet) */}
      <AD.Root open={appearance} onOpenChange={setAppearance}>
        <AD.Portal>
          <AD.Overlay className="vo-sheet-overlay" />
          <AD.Content className="vo-sheet vo-apple" data-testid="appearance-sheet" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="vo-sheet-group">
              <div className="vo-sheet-head">
                <AD.Title className="vo-sheet-title">Appearance</AD.Title>
                <AD.Description className="vo-sheet-desc">System follows your phone's light or dark setting.</AD.Description>
              </div>
              <div className="vo-sheet-list" role="radiogroup">
                {THEME_MODES.map((m) => (
                  <button key={m.value} type="button" role="radio" aria-checked={mode === m.value} onClick={() => { setMode(m.value); setAppearance(false); }} className="vo-sheet-option" data-testid={`appearance-option-${m.value}`}>
                    <span className="flex-1">{m.label}</span>
                    {mode === m.value && <Check className="h-[18px] w-[18px] shrink-0" strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="vo-sheet-cancel" onClick={() => setAppearance(false)} data-testid="appearance-cancel">
              Cancel
            </button>
          </AD.Content>
        </AD.Portal>
      </AD.Root>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Log out?"
        description="Your matches and chats stay safe. You can log back in anytime."
        confirmText="Log Out"
        ink
        onConfirm={() => {
          logout();
          navigate("/login", { replace: true });
        }}
        testId="logout-dialog"
      />
    </div>
  );
}
