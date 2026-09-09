import React, { useRef, useState } from "react";
import { MapPin, Quote, ShieldAlert, Ban } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { UserPhoto } from "@/components/UserPhoto";
import { CompatibilityRing } from "@/components/CompatibilityRing";
import { Tag } from "@/components/Chip";
import { ReactHeart } from "@/components/ReactHeart";
import { distanceLabel, activeLabel, genderLabel } from "@/lib/format";

export const PhotoCarousel = ({ photos = [], name, className = "", onReact }) => {
  const [idx, setIdx] = useState(0);
  const ref = useRef(null);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const list = photos.length ? photos : [null];
  return (
    <div className={`relative overflow-hidden rounded-sheet bg-surface2 ${className}`}>
      <div ref={ref} onScroll={onScroll} className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto">
        {list.map((p, i) => (
          <div key={`${p}-${i}`} className="relative h-full w-full shrink-0 snap-center">
            <UserPhoto src={p} name={name} className="h-full w-full text-6xl" />
            {onReact && p && (
              <div className="absolute bottom-3 right-3">
                <ReactHeart label={`Like this photo of ${name}`} onReact={() => onReact({ type: "photo", photo: p })} testId="sheet-react-photo-button" />
              </div>
            )}
          </div>
        ))}
      </div>
      {list.length > 1 && (
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {list.map((_, i) => (
            <span key={i} className={`h-[3px] flex-1 rounded-full ${i === idx ? "bg-white" : "bg-white/40"}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export const ProfileDetails = ({ profile, showShared = true, onReact }) => {
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
              <Tag key={i} tone={showShared && shared.has(i.toLowerCase()) ? "tint" : "default"}>
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
            <div key={i} className="flex items-start gap-3 rounded-card bg-surface2 p-4" data-testid="profile-prompt">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-mute">
                  <Quote className="h-3.5 w-3.5" /> {p.question}
                </div>
                <div className="font-display text-[18px] leading-snug text-ink">{p.answer}</div>
              </div>
              {onReact && (
                <ReactHeart size="sm" label={`Like ${profile.name}'s answer`} onReact={() => onReact({ type: "prompt", question: p.question })} className="mt-0.5 shrink-0" testId="sheet-react-prompt-button" />
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export const ProfileSheet = ({ profile, open, onOpenChange, actions, onBlock, onReport, onReact, note, isSelf = false }) => {
  if (!profile) return null;
  const active = activeLabel(profile.last_active);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[94dvh] max-w-[430px] rounded-t-sheet border-0 bg-white" data-testid="profile-sheet">
        <DrawerTitle className="sr-only">{profile.name}</DrawerTitle>
        <DrawerDescription className="sr-only">Profile details</DrawerDescription>
        <div className="vo-scroll px-4 pb-6 pt-2">
          {note && <div className="mb-3">{note}</div>}
          <PhotoCarousel photos={profile.photos} name={profile.name} className="aspect-[4/5] w-full" onReact={onReact} />
          <div className="mt-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[28px] font-bold leading-none tracking-tight text-ink" data-testid="profile-sheet-name">
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
                {active && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-online" />
                    {active}
                  </span>
                )}
              </div>
            </div>
            {typeof profile.compatibility === "number" && !isSelf && (
              <div className="flex flex-col items-center">
                <CompatibilityRing value={profile.compatibility} size={58} />
                <span className="mt-1 text-[11px] font-medium text-mute">match</span>
              </div>
            )}
          </div>
          {profile.shared_interests?.length > 0 && !isSelf && (
            <p className="mt-3 text-[14px] font-medium text-tint" data-testid="profile-shared">
              You both like {profile.shared_interests.slice(0, 3).join(", ")}
              {profile.shared_interests.length > 3 ? ` +${profile.shared_interests.length - 3} more` : ""}
            </p>
          )}
          {onReact && (
            <p className="mt-3 text-[13px] text-mute" data-testid="profile-react-hint">
              Tap a heart on a photo or answer to like that specifically. It shows up first in your chat if you match.
            </p>
          )}
          <div className="mt-6">
            <ProfileDetails profile={profile} showShared={!isSelf} onReact={onReact} />
          </div>
          {actions && <div className="mt-8">{actions}</div>}
          {(onBlock || onReport) && (
            <div className="mt-8 flex items-center justify-center gap-6 border-t border-line pt-5 text-[13px] font-medium text-mute">
              {onReport && (
                <button type="button" onClick={onReport} className="inline-flex items-center gap-1.5 hover:text-ink" data-testid="profile-report-button">
                  <ShieldAlert className="h-4 w-4" /> Report
                </button>
              )}
              {onBlock && (
                <button type="button" onClick={onBlock} className="inline-flex items-center gap-1.5 hover:text-danger" data-testid="profile-block-button">
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
