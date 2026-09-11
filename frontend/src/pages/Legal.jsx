import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Spinner } from "@/components/Loading";
import { notice } from "@/lib/feedback";
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
    title: "About Voiladi",
    body: [
      { h: "A more human internet." },
      "Voiladi is a social space built around one idea: the internet should bring you closer to people, not just to content. Here you meet people, follow interests and join communities as yourself, with real conversations at the centre of everything.",
      { h: "Our story" },
      "Voiladi began with a simple observation. Most of what we scroll through every day is designed to be watched, not shared. We wanted a place where saying hello matters more than going viral, where a profile is a person and not a performance, and where the quiet, everyday moments count as much as the highlights.",
      { h: "Our vision" },
      "A calmer, kinder internet where people feel seen. No noise, no algorithms pushing outrage, no pressure to perform. Just people, interests and communities that feel like they were made for you.",
      { h: "Our mission" },
      "To make meeting people online feel as natural as meeting them in real life. We do this through verified profiles, private-first messaging, thoughtful discovery and communities that grow around shared interests rather than follower counts.",
      { h: "What we stand for" },
      "Be real: one real name, real photos, real you. Be kind: respect is the baseline, not a bonus. Be present: less scrolling, more talking. Be safe: your privacy and comfort come before growth.",
      "Voiladi is for people aged 18 and over. Version 2.0.",
    ],
  },
  help: {
    title: "Help & Support",
    body: [
      "Something not working? Reach us at support@voiladi.com and we'll get back to you.",
      "Feeling unsafe? Use Report or Block from any profile or chat. Reports are private and reviewed by a person.",
      "Want to start fresh? You can delete your account from Privacy & Safety.",
    ],
  },
  guidelines: {
    title: "Community Guidelines",
    body: [
      "Be real. Use your own recent photos and your real first name. Impersonation and catfishing lead to removal.",
      "Be respectful. No harassment, hate speech, threats or unsolicited explicit content. A no is a no.",
      "Keep it personal, not commercial. No promotion, spam, scams or asking for money.",
      "Protect privacy. Never share someone else's photos, messages or personal details without their consent.",
      "Adults only. Voiladi is for people aged 18 and over. Report anyone who appears underage.",
    ],
  },
};

const Body = ({ page }) => (
  <div className="space-y-4 px-5 pb-10 pt-4 text-[15px] leading-relaxed text-ink" data-testid="legal-body">
    {page === "about" && <LogoMark size={64} className="mb-2" />}
    {PAGES[page].body.map((p, i) =>
      typeof p === "string" ? (
        <p key={i}>{p}</p>
      ) : (
        <h2 key={i} className="pt-2 text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink" data-testid="legal-heading">
          {p.h}
        </h2>
      )
    )}
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
      navigate("/login", { replace: true });
    } catch (e) {
      notice(errMsg(e));
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
    if (!supported || perm === "denied") return; // switch is disabled; the helper text below explains
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
          {busy ? <Spinner size={16} stroke={2} className="text-mute" /> : <Switch checked={on} disabled={!supported || perm === "denied"} onCheckedChange={toggle} aria-label="Push notifications" className="data-[state=checked]:bg-ink" data-testid="notifications-push-switch" />}
        </div>
      </div>
      <p className="px-1 text-[13px] text-mute">{perm === "denied" ? "Notifications are blocked for this site. Allow them in your browser settings." : !supported ? "Notifications aren't supported on this device." : "You'll also see in-app banners while Voiladi is open."}</p>
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
