import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, User, Shield, Bell, SlidersHorizontal, Globe, Moon, CircleHelp, FileText, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { ModalHeader } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/Dialogs";

const Row = ({ icon: Icon, label, value, onClick, right, testId }) => {
  const inner = (
    <>
      <Icon className="h-[22px] w-[22px] shrink-0 text-ink" strokeWidth={1.75} />
      <span className="flex-1">{label}</span>
      {value && <span className="text-[14px] font-normal text-mute">{value}</span>}
      {right !== undefined ? right : <ChevronRight className="h-[18px] w-[18px] text-mute" strokeWidth={2} />}
    </>
  );
  if (!onClick) {
    return (
      <div className="vo-row hover:bg-surface active:bg-surface" data-testid={testId}>
        {inner}
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick} className="vo-row" data-testid={testId}>
      {inner}
    </button>
  );
};

export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { dark, setDark } = useTheme();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex min-h-full flex-col" data-testid="settings-page">
      <ModalHeader
        left={
          <button type="button" className="-ml-2 flex items-center text-[16px] text-ink" onClick={() => navigate("/profile")} data-testid="settings-back-button">
            <ChevronLeft className="h-5 w-5" strokeWidth={2} /> Back
          </button>
        }
        title="Settings"
      />

      <div className="flex-1 space-y-4 px-4 pb-10 pt-2">
        <div className="vo-card overflow-hidden">
          <Row icon={User} label="Account" onClick={() => navigate("/profile/edit")} testId="settings-account-row" />
          <Row icon={Shield} label="Privacy & Safety" onClick={() => navigate("/legal/safety")} testId="settings-privacy-row" />
          <Row icon={Bell} label="Notifications" onClick={() => navigate("/legal/notifications")} testId="settings-notifications-row" />
          <Row icon={SlidersHorizontal} label="Preferences" onClick={() => navigate("/filters")} testId="settings-preferences-row" />
          <Row icon={Globe} label="Language" value="English" testId="settings-language-row" />
          <Row icon={Moon} label="Dark Mode" right={<Switch checked={dark} onCheckedChange={setDark} aria-label="Dark mode" data-testid="settings-dark-mode-switch" className="data-[state=checked]:bg-ink" />} testId="settings-dark-mode-row" />
        </div>

        <div className="vo-card overflow-hidden">
          <Row icon={CircleHelp} label="Help & Support" onClick={() => navigate("/legal/help")} testId="settings-help-row" />
          <Row icon={FileText} label="Terms of Service" onClick={() => navigate("/legal/terms")} testId="settings-terms-row" />
          <Row icon={Info} label="About VOILADI" onClick={() => navigate("/legal/about")} testId="settings-about-row" />
        </div>

        <div className="pt-6">
          <button type="button" className="vo-card flex h-[52px] w-full items-center justify-center text-[15px] font-semibold text-red active:bg-surface2" onClick={() => setConfirm(true)} data-testid="profile-logout-button">
            Log Out
          </button>
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
