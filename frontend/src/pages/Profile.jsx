import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, PencilLine, SlidersHorizontal, LogOut, Trash2, Eye, MapPin, Camera, Quote, Heart } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { UserPhoto } from "@/components/UserPhoto";
import { PageHeader } from "@/components/EmptyState";
import { ProfileSheet } from "@/components/ProfileSheet";
import { ConfirmDialog } from "@/components/Dialogs";
import { showMeLabel } from "@/lib/format";

const Row = ({ icon: Icon, title, sub, onClick, testId, tone = "default" }) => (
  <button type="button" onClick={onClick} className="vo-row" data-testid={testId}>
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${tone === "danger" ? "bg-pass-soft text-pass" : "bg-surface2 text-ink"}`}>
      <Icon className="h-5 w-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className={`block text-[15px] font-semibold ${tone === "danger" ? "text-pass" : "text-ink"}`}>{title}</span>
      {sub && <span className="block truncate text-[13px] text-mute">{sub}</span>}
    </span>
    <ChevronRight className="h-5 w-5 text-mute" />
  </button>
);

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const checks = [
    { ok: (user.photos?.length || 0) >= 3, label: "3+ photos", icon: Camera },
    { ok: !!user.bio, label: "A bio", icon: PencilLine },
    { ok: (user.prompts?.length || 0) >= 2, label: "2+ prompts", icon: Quote },
    { ok: !!user.city, label: "Location", icon: MapPin },
  ];
  const done = checks.filter((c) => c.ok).length;
  const strength = Math.round(40 + (done / checks.length) * 60);
  const prefs = user.preferences || {};

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
      setConfirm(null);
    }
  };

  return (
    <div className="min-h-full pb-28" data-testid="profile-page">
      <PageHeader title="You" />

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 vo-card overflow-hidden" data-testid="profile-summary-card">
        <div className="flex items-center gap-4 p-4">
          <UserPhoto src={user.photos?.[0]} name={user.name} className="h-24 w-24 shrink-0 rounded-[26px] text-2xl" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-[24px] font-semibold leading-tight text-ink" data-testid="profile-name">
              {user.name}
              {user.age ? <span className="ml-2 font-medium text-mute">{user.age}</span> : null}
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-[14px] text-mute">
              <MapPin className="h-3.5 w-3.5" /> {user.city || "No location set"}
            </p>
            <button type="button" className="vo-btn-secondary mt-3 h-10 px-4 text-[14px]" onClick={() => setPreview(true)} data-testid="profile-preview-button">
              <Eye className="h-4 w-4" /> Preview profile
            </button>
          </div>
        </div>
        <div className="border-t border-line bg-[rgba(244,246,250,0.6)] px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">Profile strength</span>
            <span className="font-display text-[14px] font-bold text-brand-dark" data-testid="profile-strength">
              {strength}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
            <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${strength}%` }} transition={{ type: "spring", stiffness: 80, damping: 20 }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {checks.map((c) => (
              <span key={c.label} className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ${c.ok ? "bg-like-soft text-like" : "bg-white text-mute"}`}>
                <c.icon className="h-3.5 w-3.5" /> {c.label}
              </span>
            ))}
          </div>
        </div>
      </motion.section>

      <section className="mt-6 px-3">
        <div className="vo-label px-2 pb-2">Profile</div>
        <Row icon={PencilLine} title="Edit profile" sub="Photos, bio, interests and prompts" onClick={() => navigate("/profile/edit")} testId="profile-edit-button" />
        <Row
          icon={SlidersHorizontal}
          title="Discovery preferences"
          sub={`${showMeLabel(prefs.show_me)} · ${prefs.age_min}-${prefs.age_max} · ${prefs.max_distance_km >= 250 ? "Anywhere" : `${prefs.max_distance_km} km`}`}
          onClick={() => navigate("/profile/preferences")}
          testId="profile-preferences-button"
        />
      </section>

      <section className="mt-6 px-3">
        <div className="vo-label px-2 pb-2">Account</div>
        <Row icon={LogOut} title="Log out" sub={user.phone} onClick={() => setConfirm("logout")} testId="profile-logout-button" />
        <Row icon={Trash2} title="Delete account" sub="Permanently remove your profile and chats" onClick={() => setConfirm("delete")} testId="profile-delete-button" tone="danger" />
      </section>

      <p className="mt-8 flex items-center justify-center gap-1 text-center text-[12px] text-mute">
        <Heart className="h-3 w-3 fill-brand text-brand" /> Voiladi 1.0 · Made for people, by people
      </p>

      <ProfileSheet profile={{ ...user, distance_km: undefined }} open={preview} onOpenChange={setPreview} isSelf />
      <ConfirmDialog
        open={confirm === "logout"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Log out?"
        description="You'll need your phone number to sign back in. Your matches and chats stay safe."
        confirmText="Log out"
        onConfirm={() => {
          logout();
          navigate("/welcome", { replace: true });
        }}
        testId="logout-dialog"
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
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
}
