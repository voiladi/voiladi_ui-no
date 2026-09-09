import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Spinner } from "@/components/Loading";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ModalHeader } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/Dialogs";
import { LogoMark } from "@/components/Logo";

const PAGES = {
  terms: {
    title: "Terms of Service",
    body: [
      "Voiladi is for people aged 18 and over. By creating an account you confirm you are at least 18.",
      "Be yourself. Use your real name, your own photos and accurate information about you.",
      "Be kind. Harassment, hate, threats, spam, scams and sharing explicit content without consent are not allowed and lead to removal.",
      "You own the content you post and give Voiladi permission to show it to other members so the app can work.",
      "We may suspend or delete accounts that break these rules. You can delete your account at any time from Privacy & Safety.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    body: [
      "We store the details you give us (name, date of birth, gender, email, phone number, photos, interests and prompts) to run your profile.",
      "Your phone number and email are never shown to other members. Your exact location is never shown either; other people only see an approximate distance.",
      "Messages are stored so both people in a match can read them. Unmatching or blocking ends the conversation.",
      "We do not sell your data. Deleting your account permanently removes your profile, photos, matches and messages.",
    ],
  },
  about: {
    title: "About VOILADI",
    body: ["Good people. Better connections.", "Voiladi is a dating app made for 18 to 30-year-olds who want real conversations, not endless scrolling.", "Version 2.0"],
  },
  help: {
    title: "Help & Support",
    body: [
      "Something not working? Reach us at support@voiladi.com and we'll get back to you.",
      "Feeling unsafe? Use Report or Block from any profile or chat. Reports are private and reviewed by a person.",
      "Want to start fresh? You can delete your account from Privacy & Safety.",
    ],
  },
};

const Body = ({ page }) => (
  <div className="space-y-4 px-5 pb-10 pt-4 text-[15px] leading-relaxed text-ink" data-testid="legal-body">
    {page === "about" && <LogoMark size={64} className="mb-2" />}
    {PAGES[page].body.map((p, i) => (
      <p key={i}>{p}</p>
    ))}
  </div>
);

const Safety = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const doDelete = async () => {
    setBusy(true);
    try {
      await api.delete("/auth/account");
      logout();
      toast("Your account has been deleted. Take care.");
      navigate("/welcome", { replace: true });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };
  return (
    <div className="space-y-4 px-5 pb-10 pt-2">
      <div className="vo-card p-4 text-[14px] leading-relaxed text-ink">
        <div className="vo-section mb-1">Blocking and reporting</div>
        Block or report anyone from their profile or chat. Blocked people can't see you or message you, and they're never told.
      </div>
      <div className="vo-card p-4 text-[14px] leading-relaxed text-ink">
        <div className="vo-section mb-1">What others see</div>
        Your name, age, photos, interests and prompts. Never your phone number, email or exact location.
      </div>
      <button type="button" className="vo-link" onClick={() => navigate("/legal/privacy")} data-testid="safety-privacy-link">
        Read the Privacy Policy
      </button>
      <div className="pt-6">
        <button type="button" className="vo-card flex h-[52px] w-full items-center justify-center text-[15px] font-semibold text-red active:bg-surface2" onClick={() => setConfirm(true)} data-testid="profile-delete-button">
          Delete account
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete your account?"
        description="This permanently deletes your profile, photos, matches and messages. There's no undo."
        confirmText="Delete everything"
        danger
        loading={busy}
        onConfirm={doDelete}
        testId="delete-dialog"
      />
    </div>
  );
};

const Notifications = () => {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : "unsupported");
  const [busy, setBusy] = useState(false);
  const on = perm === "granted";
  const toggle = async () => {
    if (!supported || perm === "denied") {
      toast("Turn notifications on or off in your browser settings");
      return;
    }
    setBusy(true);
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4 px-5 pb-10 pt-2">
      <div className="vo-card overflow-hidden">
        <div className="vo-row justify-between hover:bg-surface" data-testid="notifications-push-row">
          <span>
            <span className="block">Push notifications</span>
            <span className="block text-[12px] font-normal text-mute">New matches and messages</span>
          </span>
          {busy ? <Spinner size={16} stroke={2} className="text-mute" /> : <Switch checked={on} onCheckedChange={toggle} aria-label="Push notifications" className="data-[state=checked]:bg-ink" data-testid="notifications-push-switch" />}
        </div>
      </div>
      <p className="px-1 text-[13px] text-mute">{perm === "denied" ? "Notifications are blocked for this site. Allow them in your browser settings." : "You'll also see in-app banners while Voiladi is open."}</p>
    </div>
  );
};

export default function Legal() {
  const { page = "terms" } = useParams();
  const navigate = useNavigate();
  const title = page === "safety" ? "Privacy & Safety" : page === "notifications" ? "Notifications" : (PAGES[page] || PAGES.terms).title;
  return (
    <div className="flex min-h-full flex-col" data-testid={`legal-page-${page}`}>
      <ModalHeader
        left={
          <button type="button" className="-ml-2 flex items-center text-[16px] text-ink" onClick={() => navigate(-1)} data-testid="legal-back-button">
            <ChevronLeft className="h-5 w-5" strokeWidth={2} /> Back
          </button>
        }
        title={title}
      />
      {page === "safety" ? <Safety /> : page === "notifications" ? <Notifications /> : <Body page={PAGES[page] ? page : "terms"} />}
    </div>
  );
}
