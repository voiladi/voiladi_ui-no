import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Settings, Camera, ChevronRight, Zap, Star, Crown, User, Lock, SlidersHorizontal, CircleHelp } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useStats } from "@/hooks/useStats";
import { useBadges } from "@/hooks/useBadges";
import { Brand } from "@/components/Logo";
import { UserPhoto } from "@/components/UserPhoto";
import { Skeleton } from "@/components/Loading";

/* ---------- profile screen, transcribed from the reference image ---------- */

const Stat = ({ label, value, testId }) => (
  <div className="flex min-w-0 flex-1 flex-col items-center">
    <span className="flex h-[19px] items-center text-[19px] font-bold leading-none tracking-[-0.01em] text-ink" data-testid={testId}>
      {value ?? <Skeleton className="h-4 w-7 rounded-full" />}
    </span>
    <span className="mt-1.5 whitespace-nowrap text-[13px] leading-none text-mute">{label}</span>
  </div>
);

const StatDivider = () => <span className="h-10 w-px shrink-0 bg-line" aria-hidden="true" />;

/* Boost / Super Likes / VOILADI+ : white icon tile, bold title, muted subtitle, white value pill, chevron. */
const FeatureRow = ({ icon: Icon, title, sub, pill, onClick, testId, pillTestId }) => (
  <button type="button" onClick={onClick} className="vo-prow" data-testid={testId}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-bg text-ink">
      <Icon className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[17px] font-bold leading-[22px] tracking-[-0.01em] text-ink">{title}</span>
      <span className="block truncate text-[12.5px] leading-[18px] tracking-[-0.02em] text-mute">{sub}</span>
    </span>
    {pill !== undefined && (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-bg px-2 text-[13px] font-semibold tabular-nums tracking-[-0.01em] text-ink" data-testid={pillTestId}>
        {pill}
      </span>
    )}
    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-mute" strokeWidth={2.4} />
  </button>
);

/* Account / Privacy & Safety / Preferences / Help & Support */
const MenuRow = ({ icon: Icon, label, onClick, testId }) => (
  <button type="button" onClick={onClick} className="vo-prow h-[46px]" data-testid={testId}>
    <span className="flex w-10 shrink-0 items-center justify-center text-ink">
      <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
    </span>
    <span className="flex-1 truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">{label}</span>
    <ChevronRight className="h-[18px] w-[18px] shrink-0 text-mute" strokeWidth={2} />
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

const hhmmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

/* Live countdown while a Boost is running (as in the reference: 01:23:45). */
const useCountdown = (untilIso) => {
  const [left, setLeft] = useState(() => (untilIso ? new Date(untilIso).getTime() - Date.now() : 0));
  useEffect(() => {
    if (!untilIso) {
      setLeft(0);
      return undefined;
    }
    const tick = () => setLeft(new Date(untilIso).getTime() - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [untilIso]);
  return left;
};

export default function Profile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: stats } = useStats(!!user);
  const { likes, unread } = useBadges();
  const [boosting, setBoosting] = useState(false);
  const boostLeft = useCountdown(stats?.boost_active ? stats.boost_until : null);

  useEffect(() => {
    // when the running boost hits zero, refresh the numbers
    if (stats?.boost_active && boostLeft <= 0) qc.invalidateQueries({ queryKey: ["stats"] });
  }, [boostLeft, stats?.boost_active, qc]);

  if (!user) return null;
  const { pct } = completion(user);
  const complete = pct >= 100;

  const startBoost = async () => {
    if (boosting) return;
    if (stats?.boost_active) {
      toast(`Boost is running - ${hhmmss(boostLeft)} left`);
      return;
    }
    setBoosting(true);
    try {
      await api.post("/me/boost");
      await qc.invalidateQueries({ queryKey: ["stats"] });
      toast("Boost started. You'll be seen by more people for 90 minutes.");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBoosting(false);
    }
  };

  const boostPill = !stats ? <Skeleton className="h-3 w-8 rounded-full" /> : stats.boost_active ? hhmmss(boostLeft) : stats.boost_next_at ? "Tomorrow" : "Start";

  return (
    <div className="min-h-full pb-24" data-testid="profile-page">
      {/* header: brand left, bell (red dot when there is something new) + gear right */}
      <header className="flex h-14 items-center justify-between px-4 pt-1">
        <Brand size={30} />
        <div className="flex items-center gap-3">
          <button type="button" className="vo-icon-btn relative h-10 w-10" onClick={() => navigate("/likes")} aria-label="Notifications" data-testid="profile-notifications-button">
            <Bell className="h-5 w-5" strokeWidth={2} />
            {likes + unread > 0 && <span className="absolute right-[7px] top-[7px] h-2 w-2 rounded-full bg-red ring-2 ring-surface" data-testid="profile-notifications-dot" />}
          </button>
          <button type="button" className="vo-icon-btn h-10 w-10" onClick={() => navigate("/settings")} aria-label="Settings" data-testid="profile-settings-button">
            <Settings className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* avatar + name / tagline / stats */}
      <section className="mt-3 flex items-start gap-3 px-4" data-testid="profile-summary-card">
        <button type="button" className="relative shrink-0" onClick={() => navigate("/profile/edit")} aria-label="Change photo" data-testid="profile-avatar-button">
          <UserPhoto src={user.photos?.[0]} name={user.name} className="h-[100px] w-[100px] rounded-full text-[34px]" />
          <span className="absolute bottom-0 right-0 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-bg text-ink shadow-action">
            <Camera className="h-4 w-4" strokeWidth={2} />
          </span>
        </button>

        <div className="min-w-0 flex-1 pt-1">
          <h1 className="truncate text-[28px] font-bold leading-[32px] tracking-[-0.02em] text-ink" data-testid="profile-name">
            {user.name}
          </h1>
          <button type="button" className="mt-1 flex w-full items-center gap-1.5 text-left" onClick={() => navigate("/profile/edit")} data-testid="profile-edit-button">
            <span className="truncate text-[14px] leading-[20px] tracking-[-0.01em] text-mute">{user.bio || "Good people. Better connections."}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-mute" strokeWidth={2} />
          </button>

          <div className="mt-4 flex items-center" data-testid="profile-stats">
            <Stat label="Followers" value={stats?.followers} testId="profile-stat-likes" />
            <StatDivider />
            <Stat label="Following" value={stats?.following} testId="profile-stat-following" />
            <StatDivider />
            <Stat label="Profile views" value={stats?.profile_views} testId="profile-stat-views" />
          </div>
        </div>
      </section>

      {/* profile completion */}
      <section className="mx-4 mt-5">
        <button type="button" className="vo-card w-full rounded-[20px] p-4 text-left" onClick={() => navigate("/profile/edit")} data-testid="profile-completion-card">
          <span className="block text-[12px] font-semibold uppercase leading-none tracking-[0.06em] text-mute">Profile completion</span>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="truncate text-[23px] font-bold leading-[28px] tracking-[-0.02em] text-ink">{complete ? "Your profile is complete" : "You're almost there"}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-[23px] font-bold leading-none tracking-[-0.02em] text-ink" data-testid="profile-strength">
                {pct}%
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface2 text-mute">
                <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
              </span>
            </span>
          </div>
          <p className="mt-1.5 text-[15px] leading-[21px] text-mute">
            {complete ? "Nice. You're set up to get the best matches on VOILADI." : "Add a few more details to get better matches on VOILADI."}
          </p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </button>
      </section>

      {/* boost / super likes / plus */}
      <section className="vo-card mx-4 mt-3 overflow-hidden rounded-[20px]" data-testid="profile-features">
        <FeatureRow icon={Zap} title="Boost" sub="Be seen by more people" pill={boostPill} onClick={startBoost} testId="profile-boost-row" pillTestId="profile-boost-pill" />
        <FeatureRow icon={Star} title="Super Likes" sub="Show someone you're really interested" pill={stats ? stats.voilas_left : <Skeleton className="h-3 w-4 rounded-full" />} onClick={() => navigate("/discover")} testId="profile-superlikes-row" pillTestId="profile-superlikes-pill" />
        <FeatureRow icon={Crown} title="VOILADI+" sub="Unlock premium features" onClick={() => toast("VOILADI+ is coming soon")} testId="profile-plus-row" />
      </section>

      {/* account menu */}
      <section className="vo-card mx-4 mt-3 overflow-hidden rounded-[20px]" data-testid="profile-menu">
        <MenuRow icon={User} label="Account" onClick={() => navigate("/profile/edit")} testId="profile-menu-account" />
        <MenuRow icon={Lock} label="Privacy & Safety" onClick={() => navigate("/legal/safety")} testId="profile-menu-privacy" />
        <MenuRow icon={SlidersHorizontal} label="Preferences" onClick={() => navigate("/filters")} testId="profile-menu-preferences" />
        <MenuRow icon={CircleHelp} label="Help & Support" onClick={() => navigate("/legal/help")} testId="profile-menu-help" />
      </section>
    </div>
  );
}
