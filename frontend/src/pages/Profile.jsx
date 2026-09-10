import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Settings, Camera, ChevronRight, Zap, Star, Crown, User, Lock, SlidersHorizontal, CircleHelp } from "lucide-react";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useStats } from "@/hooks/useStats";
import { useNotifications } from "@/hooks/useNotifications";
import { SoftHeader, SoftIconButton, SoftCard, SoftPill } from "@/components/SoftUI";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { UserPhoto } from "@/components/UserPhoto";
import { Skeleton, Spinner } from "@/components/Loading";

/* ---------- profile screen, transcribed from the neumorphic reference (393 x 852 canvas) ---------- */

const Stat = ({ label, value, testId }) => (
  <div className="flex min-w-0 flex-1 flex-col items-center px-0.5">
    <span className="flex h-[24px] items-center text-[clamp(17px,5cqi,20px)] font-bold leading-none tracking-[-0.01em] text-ink" data-testid={testId}>
      {value ?? <Skeleton className="h-4 w-7 rounded-full" />}
    </span>
    <span className="mt-1 text-center text-[clamp(11px,3.3cqi,13px)] leading-[1.1] text-mute">{label}</span>
  </div>
);

const StatDivider = () => <span className="h-8 w-px shrink-0 bg-line" aria-hidden="true" />;

/* Boost / Super Likes / VOILADI+ : raised icon tile, bold title, muted subtitle, raised value pill, chevron. */
const FeatureRow = ({ icon: Icon, title, sub, pill, onClick, testId, pillTestId, soon = false, last = false }) => (
  <button type="button" onClick={onClick} className={`flex h-[60px] w-full items-center gap-2.5 px-3.5 text-left focus-visible:outline-none active:opacity-80 ${last ? "" : "border-b border-line/80"}`} aria-disabled={soon || undefined} data-testid={testId}>
    <span className="vo-soft-tile h-[40px] w-[40px] rounded-[12px]">
      <Icon className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[17px] font-bold leading-[21px] tracking-[-0.01em] text-ink">{title}</span>
      <span className="block truncate text-[12.5px] leading-[16px] tracking-[-0.02em] text-mute">{sub}</span>
    </span>
    {soon ? (
      <span className="vo-soft inline-flex h-[32px] shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold tracking-[-0.01em] text-mute" data-testid={pillTestId}>
        Soon
      </span>
    ) : (
      pill !== undefined && (
        <span className="vo-soft inline-flex h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-full px-2.5 text-[14px] font-semibold tabular-nums tracking-[-0.01em] text-ink" data-testid={pillTestId}>
          {pill}
        </span>
      )
    )}
    <ChevronRight className="h-[18px] w-[18px] shrink-0 text-mute" strokeWidth={2} />
  </button>
);

/* Account / Privacy & Safety / Preferences / Help & Support */
const MenuRow = ({ icon: Icon, label, onClick, testId, last = false }) => (
  <button type="button" onClick={onClick} className={`flex h-[48px] w-full items-center gap-2.5 px-3.5 text-left focus-visible:outline-none active:opacity-80 ${last ? "" : "border-b border-line/80"}`} data-testid={testId}>
    <span className="flex w-[40px] shrink-0 items-center justify-center text-ink">
      <Icon className="h-6 w-6" strokeWidth={1.75} />
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
  const { data: notif } = useNotifications(!!user);
  const unseen = notif?.unseen_count || 0;
  const [boosting, setBoosting] = useState(false);
  const boostLeft = useCountdown(stats?.boost_active ? stats.boost_until : null);

  useEffect(() => {
    if (stats?.boost_active && boostLeft <= 0) qc.invalidateQueries({ queryKey: ["stats"] });
  }, [boostLeft, stats?.boost_active, qc]);

  if (!user) return null;
  const { pct } = completion(user);
  const vstatus = user?.verification?.status || "none";
  const complete = pct >= 100;

  const startBoost = async () => {
    if (boosting) return;
    if (stats?.boost_active) return; // the pill already shows the live countdown
    setBoosting(true);
    try {
      await api.post("/me/boost");
      await qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setBoosting(false);
    }
  };

  const boostPill = boosting ? <Spinner size={16} stroke={2.2} /> : !stats ? <Skeleton className="h-3 w-8 rounded-full" /> : stats.boost_active ? hhmmss(boostLeft) : stats.boost_next_at ? "Tomorrow" : "Start";

  return (
    <div className="vo-neu-page flex min-h-full flex-col" style={{ paddingBottom: "calc(var(--nav-h) + var(--nav-gap) + 10px + env(safe-area-inset-bottom, 0px))" }} data-testid="profile-page">
      {/* header: brand left, bell (red dot when there is something new) + gear right */}
      <header className="shrink-0 px-5 pt-1">
        <SoftHeader
          right={
            <>
              <span className="relative">
                <SoftIconButton icon={Bell} label="Notifications" onClick={() => navigate("/notifications")} testId="profile-notifications-button" strokeWidth={1.9} />
                {unseen > 0 && <span className="pointer-events-none absolute right-[9px] top-[8px] h-2 w-2 rounded-full bg-red ring-2 ring-[color:var(--soft-bg)]" data-testid="profile-notifications-dot" />}
              </span>
              <SoftIconButton icon={Settings} label="Settings" onClick={() => navigate("/settings")} testId="profile-settings-button" strokeWidth={1.9} />
            </>
          }
        />
      </header>

      {/* avatar + name / edit / stats */}
      <section className="mt-3 flex items-start gap-[clamp(12px,4cqi,16px)] px-4" data-testid="profile-summary-card">
        <button type="button" className="vo-soft relative flex h-[clamp(84px,24cqi,96px)] w-[clamp(84px,24cqi,96px)] shrink-0 items-center justify-center rounded-full" onClick={() => navigate("/profile/edit")} aria-label="Change photo" data-testid="profile-avatar-button">
          <UserPhoto src={user.photos?.[0]} name={user.name} size="xs" className="h-[79%] w-[79%] rounded-[22px] text-[30px]" />
          <span className="vo-soft absolute -bottom-0.5 right-0 flex h-[34px] w-[34px] items-center justify-center rounded-full text-ink">
            <Camera className="h-4 w-4" strokeWidth={2} />
          </span>
        </button>

        <div className="min-w-0 flex-1 pt-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[clamp(23px,7cqi,28px)] font-bold leading-[1.15] tracking-[-0.02em] text-ink" data-testid="profile-name">
              {user.name}
            </h1>
            {user.verified && <VerifiedBadge size={22} testId="profile-verified-badge" />}
          </div>
          {user.username && (
            <p className="mt-0.5 truncate text-[clamp(14px,4cqi,16px)] leading-[1.25] tracking-[-0.01em] text-mute" data-testid="profile-username">
              @{user.username}
            </p>
          )}
          {!user.verified && (
            <div>
              <button type="button" onClick={() => navigate("/settings/verification")} className="mt-0.5 inline-flex items-center gap-0.5 text-[13px] leading-[16px] tracking-[-0.01em] text-mute active:opacity-60 focus-visible:outline-none" data-testid="profile-not-verified-link" data-status={vstatus}>
                {vstatus === "pending" ? "Verification in review" : "Not verified"}
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </div>
          )}
          <SoftPill className="mt-2.5 h-[40px] px-5 text-[16px]" onClick={() => navigate("/profile/edit")} testId="profile-edit-button">
            Edit profile
          </SoftPill>

          <div className="mt-3.5 flex items-center" data-testid="profile-stats">
            <Stat label="Followers" value={stats?.followers} testId="profile-stat-likes" />
            <StatDivider />
            <Stat label="Following" value={stats?.following} testId="profile-stat-following" />
            <StatDivider />
            <Stat label="Profile views" value={stats?.profile_views} testId="profile-stat-views" />
          </div>
        </div>
      </section>

      {/* profile completion */}
      <section className="mx-4 mt-3.5">
        <SoftCard as="button" type="button" className="w-full px-4 py-3 text-left focus-visible:outline-none active:opacity-90" onClick={() => navigate("/profile/edit")} testId="profile-completion-card">
          <span className="block text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-mute">Profile completion</span>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span className="min-w-0 text-[clamp(18px,5.3cqi,21px)] font-bold leading-[1.2] tracking-[-0.02em] text-ink">{complete ? "Your profile is complete" : "You're almost there"}</span>
            <span className="vo-soft flex h-[38px] shrink-0 items-center gap-1.5 rounded-full pl-3.5 pr-2.5">
              <span className="text-[19px] font-bold leading-none tracking-[-0.02em] text-ink" data-testid="profile-strength">
                {pct}%
              </span>
              <ChevronRight className="h-[18px] w-[18px] text-mute" strokeWidth={2.2} />
            </span>
          </div>
          <p className="mt-1.5 max-w-[300px] text-[14px] leading-[19px] text-mute">
            {complete ? "Nice. You're set up to get the best matches on VOILADI." : "Add a few more details to get better matches on VOILADI."}
          </p>
          <div className="mt-3.5 h-[7px] w-full overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </SoftCard>
      </section>

      {/* boost / super likes / plus */}
      <SoftCard className="mx-4 mt-3 overflow-hidden" testId="profile-features">
        <FeatureRow icon={Zap} title="Boost" sub="Be seen by more people" pill={boostPill} onClick={startBoost} testId="profile-boost-row" pillTestId="profile-boost-pill" />
        <FeatureRow icon={Star} title="Super Likes" sub="Show someone you're really interested" pill={stats ? stats.voilas_left : <Skeleton className="h-3 w-4 rounded-full" />} onClick={() => navigate("/discover")} testId="profile-superlikes-row" pillTestId="profile-superlikes-pill" />
        <FeatureRow icon={Crown} title="VOILADI+" sub="Unlock premium features" soon testId="profile-plus-row" pillTestId="profile-plus-pill" last />
      </SoftCard>

      {/* account menu */}
      <SoftCard className="mx-4 mt-3 overflow-hidden" testId="profile-menu">
        <MenuRow icon={User} label="Account" onClick={() => navigate("/profile/edit")} testId="profile-menu-account" />
        <MenuRow icon={Lock} label="Privacy & Safety" onClick={() => navigate("/legal/safety")} testId="profile-menu-privacy" />
        <MenuRow icon={SlidersHorizontal} label="Preferences" onClick={() => navigate("/filters")} testId="profile-menu-preferences" />
        <MenuRow icon={CircleHelp} label="Help & Support" onClick={() => navigate("/legal/help")} testId="profile-menu-help" last />
      </SoftCard>
    </div>
  );
}
