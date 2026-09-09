import React from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Settings, Camera, ChevronRight, Zap, Star, Crown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useStats } from "@/hooks/useStats";
import { Brand } from "@/components/Logo";
import { UserPhoto } from "@/components/UserPhoto";

const Stat = ({ label, value, testId }) => (
  <div className="flex flex-1 flex-col items-center">
    <span className="text-[20px] font-bold leading-none text-ink" data-testid={testId}>
      {value ?? "-"}
    </span>
    <span className="mt-1.5 text-[12px] text-mute">{label}</span>
  </div>
);

const FeatureRow = ({ icon: Icon, title, sub, pill, onClick, testId }) => (
  <button type="button" onClick={onClick} className="vo-card-line flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface" data-testid={testId}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
      <Icon className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold text-ink">{title}</span>
      <span className="block text-[13px] text-mute">{sub}</span>
    </span>
    {pill !== undefined && <span className="rounded-full bg-surface px-3 py-1 text-[13px] font-semibold text-ink">{pill}</span>}
    <ChevronRight className="h-4 w-4 shrink-0 text-mute" />
  </button>
);

export const completion = (user) => {
  if (!user) return { pct: 0, missing: [] };
  const checks = [
    [!!user.name, "name"],
    [!!user.gender, "gender"],
    [(user.photos?.length || 0) >= 1, "a photo"],
    [(user.photos?.length || 0) >= 3, "3 photos"],
    [(user.interests?.length || 0) >= 3, "3 interests"],
    [!!user.bio, "a bio"],
    [(user.prompts?.length || 0) >= 1, "a prompt"],
    [!!user.city, "your location"],
    [!!user.job, "what you do"],
  ];
  const done = checks.filter((c) => c[0]).length;
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter((c) => !c[0]).map((c) => c[1]) };
};

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: stats } = useStats(!!user);
  if (!user) return null;
  const { pct, missing } = completion(user);

  return (
    <div className="min-h-full pb-24" data-testid="profile-page">
      <header className="flex h-14 items-center justify-between px-5 pt-2">
        <Brand />
        <div className="flex items-center gap-2">
          <button type="button" className="vo-icon-btn" onClick={() => navigate("/likes")} aria-label="Notifications" data-testid="profile-notifications-button">
            <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <button type="button" className="vo-icon-btn" onClick={() => navigate("/settings")} aria-label="Settings" data-testid="profile-settings-button">
            <Settings className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      </header>

      <section className="mt-4 flex items-center gap-4 px-5" data-testid="profile-summary-card">
        <button type="button" className="relative shrink-0" onClick={() => navigate("/profile/edit")} aria-label="Change photo" data-testid="profile-avatar-button">
          <UserPhoto src={user.photos?.[0]} name={user.name} className="h-20 w-20 rounded-full text-2xl" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-onink ring-2 ring-bg">
            <Camera className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold leading-tight text-ink" data-testid="profile-name">
            {user.name}
          </h1>
          <p className="mt-0.5 truncate text-[13px] text-mute">{user.bio || "Good people. Better connections."}</p>
          <button type="button" className="vo-btn-secondary mt-2.5 h-9 px-5 text-[13px]" onClick={() => navigate("/profile/edit")} data-testid="profile-edit-button">
            Edit Profile
          </button>
        </div>
      </section>

      <section className="mx-5 mt-6 flex items-center divide-x divide-line" data-testid="profile-stats">
        <Stat label="Followers" value={stats?.followers} testId="profile-stat-likes" />
        <Stat label="Following" value={stats?.following} testId="profile-stat-following" />
        <Stat label="Profile views" value={stats?.profile_views} testId="profile-stat-views" />
      </section>

      <section className="mx-5 mt-6">
        <button type="button" className="vo-card w-full p-4 text-left" onClick={() => navigate("/profile/edit")} data-testid="profile-completion-card">
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-semibold text-ink">{pct >= 100 ? "Your profile is complete" : "You're almost there"}</span>
            <span className="flex items-center gap-1 text-[15px] font-semibold text-ink">
              <span data-testid="profile-strength">{pct}%</span>
              <ChevronRight className="h-4 w-4 text-mute" />
            </span>
          </div>
          <p className="mt-1 text-[13px] text-mute">{pct >= 100 ? "Nice. You're set up to get the best matches on VOILADI." : `Add ${missing.slice(0, 2).join(" and ")} to get better matches on VOILADI.`}</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </button>
      </section>

      <section className="mx-5 mt-4 space-y-2.5">
        <FeatureRow icon={Zap} title="Boost" sub="Be seen by more people" pill="Soon" onClick={() => toast("Boost is coming soon")} testId="profile-boost-row" />
        <FeatureRow icon={Star} title="Super Likes" sub="Show someone you're really interested" pill={stats?.voilas_left ?? "-"} onClick={() => navigate("/discover")} testId="profile-superlikes-row" />
        <FeatureRow icon={Crown} title="VOILADI+" sub="Unlock premium features" onClick={() => toast("VOILADI+ is coming soon")} testId="profile-plus-row" />
      </section>
    </div>
  );
}
