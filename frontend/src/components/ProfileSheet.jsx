import React, { useRef, useState } from "react";
import { MapPin, Quote, ShieldAlert, Ban } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { UserPhoto } from "@/components/UserPhoto";
import { CompatibilityRing } from "@/components/CompatibilityRing";
import { Tag } from "@/components/Chip";
import { distanceLabel, activeLabel, genderLabel } from "@/lib/format";

export const PhotoCarousel = ({ photos = [], name, className = "" }) => {
  const [idx, setIdx] = useState(0);
  const ref = useRef(null);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const list = photos.length ? photos : [null];
  return (
    <div className={`relative overflow-hidden rounded-[24px] bg-surface2 ${className}`}>
      <div ref={ref} onScroll={onScroll} className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto">
        {list.map((p, i) => (
          <UserPhoto key={`${p}-${i}`} src={p} name={name} className="h-full w-full shrink-0 snap-center text-6xl" />
        ))}
      </div>
      {list.length > 1 && (
        <div className="absolute inset-x-3 top-3 flex gap-1.5">
          {list.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i === idx ? "bg-white" : "bg-white/40"}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export const ProfileDetails = ({ profile, showShared = true }) => {
  const shared = new Set((profile.shared_interests || []).map((s) => s.toLowerCase()));
  return (
    <div className="space-y-6">
      {profile.bio && (
        <p className="text-[16px] leading-relaxed text-ink" data-testid="profile-bio">
          {profile.bio}
        </p>
      )}
      {profile.interests?.length > 0 && (
        <section>
          <div className="vo-label mb-3">Into</div>
          <div className="flex flex-wrap gap-2" data-testid="profile-interests">
            {profile.interests.map((i) => (
              <Tag key={i} tone={showShared && shared.has(i.toLowerCase()) ? "brand" : "default"}>
                {i}
              </Tag>
            ))}
          </div>
        </section>
      )}
      {profile.prompts?.length > 0 && (
        <section className="space-y-3">
          <div className="vo-label">Vibe check</div>
          {profile.prompts.map((p, i) => (
            <div key={i} className="rounded-[20px] border border-line bg-[rgba(244,246,250,0.6)] p-4" data-testid="profile-prompt">
              <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-mute">
                <Quote className="h-3.5 w-3.5" /> {p.question}
              </div>
              <div className="font-display text-[18px] leading-snug text-ink">{p.answer}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export const ProfileSheet = ({ profile, open, onOpenChange, actions, onBlock, onReport, isSelf = false }) => {
  if (!profile) return null;
  const active = activeLabel(profile.last_active);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[94dvh] max-w-[430px] rounded-t-[28px] border-line bg-white" data-testid="profile-sheet">
        <DrawerTitle className="sr-only">{profile.name}</DrawerTitle>
        <DrawerDescription className="sr-only">Profile details</DrawerDescription>
        <div className="vo-scroll px-4 pb-6 pt-2">
          <PhotoCarousel photos={profile.photos} name={profile.name} className="aspect-[4/5] w-full" />
          <div className="mt-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink" data-testid="profile-sheet-name">
                {profile.name}
                {profile.age ? <span className="ml-2 font-medium text-mute">{profile.age}</span> : null}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-mute">
                {profile.gender && <span>{genderLabel(profile.gender)}</span>}
                {(profile.distance_km !== undefined || profile.city) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {isSelf ? profile.city || "No location" : distanceLabel(profile.distance_km, profile.city)}
                  </span>
                )}
                {active && <span className="inline-flex items-center gap-1 text-like"><span className="h-2 w-2 rounded-full bg-like" />{active}</span>}
              </div>
            </div>
            {typeof profile.compatibility === "number" && !isSelf && (
              <div className="flex flex-col items-center">
                <CompatibilityRing value={profile.compatibility} size={62} />
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-mute">match</span>
              </div>
            )}
          </div>
          {profile.shared_interests?.length > 0 && !isSelf && (
            <p className="mt-3 text-[14px] text-brand-dark" data-testid="profile-shared">
              You both like {profile.shared_interests.slice(0, 3).join(", ")}
              {profile.shared_interests.length > 3 ? ` +${profile.shared_interests.length - 3} more` : ""}
            </p>
          )}
          <div className="mt-6">
            <ProfileDetails profile={profile} showShared={!isSelf} />
          </div>
          {actions && <div className="mt-8">{actions}</div>}
          {(onBlock || onReport) && (
            <div className="mt-8 flex items-center justify-center gap-6 border-t border-line pt-5 text-[13px] font-semibold text-mute">
              {onReport && (
                <button type="button" onClick={onReport} className="inline-flex items-center gap-1.5 hover:text-ink" data-testid="profile-report-button">
                  <ShieldAlert className="h-4 w-4" /> Report
                </button>
              )}
              {onBlock && (
                <button type="button" onClick={onBlock} className="inline-flex items-center gap-1.5 hover:text-pass" data-testid="profile-block-button">
                  <Ban className="h-4 w-4" /> Block
                </button>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
