import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, BadgeCheck, User, Lock, Bell, SlidersHorizontal, Globe, Moon, CircleHelp, FileText, Info, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { SoftPageHeader, SoftSectionLabel, SoftCard, SoftRow } from "@/components/SoftUI";
import { ConfirmDialog } from "@/components/Dialogs";
import { formatPhone } from "@/lib/phone";

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
  const { dark, setDark } = useTheme();
  const [confirm, setConfirm] = useState(false);

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
            <SoftRow icon={User} label="Edit profile" onClick={() => navigate("/profile/edit")} testId="settings-account-row" />
            <SoftRow icon={SlidersHorizontal} label="Preferences" onClick={() => navigate("/filters")} testId="settings-preferences-row" />
            <SoftRow icon={Bell} label="Notifications" onClick={() => navigate("/legal/notifications")} testId="settings-notifications-row" />
            <SoftRow icon={Lock} label="Privacy & Safety" onClick={() => navigate("/legal/safety")} testId="settings-privacy-row" last />
          </SoftCard>
        </section>

        <section>
          <SoftSectionLabel>App</SoftSectionLabel>
          <SoftCard className="overflow-hidden" testId="settings-app-card">
            <SoftRow icon={Globe} label="Language" value="English" testId="settings-language-row" />
            <SoftRow icon={Moon} label="Dark Mode" right={<Switch checked={dark} onCheckedChange={setDark} aria-label="Dark mode" data-testid="settings-dark-mode-switch" className="data-[state=checked]:bg-ink" />} testId="settings-dark-mode-row" last />
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
          <SoftCard as="button" type="button" className="flex h-[54px] w-full items-center justify-center text-[17px] font-semibold text-red focus-visible:outline-none active:opacity-80" onClick={() => setConfirm(true)} testId="profile-logout-button">
            Log Out
          </SoftCard>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Log out?"
        description="Your matches and chats stay safe. You can log back in anytime."
        confirmText="Log Out"
        danger
        onConfirm={() => {
          logout();
          navigate("/welcome", { replace: true });
        }}
        testId="logout-dialog"
      />
    </div>
  );
}
