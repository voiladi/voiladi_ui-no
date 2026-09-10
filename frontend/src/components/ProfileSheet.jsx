import React, { useRef, useState } from "react";
import { Briefcase, MapPin, ShieldAlert, Ban } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { UserPhoto } from "@/components/UserPhoto";
import { Tag } from "@/components/Chip";
import { ReactHeart } from "@/components/ReactHeart";
import { distanceLabel, activeLabel } from "@/lib/format";

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
    <div className={`relative overflow-hidden rounded-[24px] bg-surface2 ${className}`}>
      <div ref={ref} onScroll={onScroll} className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto">
        {list.map((p, i) => (
          <div key={`${p}-${i}`} className="relative h-full w-full shrink-0 snap-center">
            <UserPhoto src={p} name={name} className="h-full w-full text-6xl" />
            {onReact && p && (
              <div className="absolute right-3 top-3">
                <ReactHeart label={`Like this photo of ${name}`} onReact={() => onReact({ type: "photo", photo: p })} testId="sheet-react-photo-button" />
              </div>
            )}
          </div>
        ))}
      </div>
      {list.length > 1 && (
        <div className="absolute inset-x-4 top-3 flex gap-1.5">
          {list.map((_, i) => (
            <span key={i} className={`h-[3px] flex-1 rounded-full ${i === idx ? "bg-white" : "bg-white/40"}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export const PromptBlock = ({ prompt, name, onReact, testId = "profile-prompt", reactTestId = "sheet-react-prompt-button" }) => (
  <div className="vo-card p-4" data-testid={testId}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-mute">{prompt.question}</div>
        <div className="mt-1.5 text-[16px] leading-snug text-ink">{prompt.answer}</div>
      </div>
      {onReact && <ReactHeart size="sm" label={`Like ${name}'s answer`} onReact={() => onReact({ type: "prompt", question: prompt.question })} className="shrink-0" testId={reactTestId} />}
    </div>
  </div>
);

export const ProfileDetails = ({ profile, onReact }) => (
  <div className="space-y-6">
    {profile.bio && (
      <section>
        <div className="vo-section mb-2">About me</div>
        <p className="text-[15px] leading-relaxed text-ink" data-testid="profile-bio">
          {profile.bio}
        </p>
      </section>
    )}
    {profile.interests?.length > 0 && (
      <section>
        <div className="vo-section mb-2">Interests</div>
        <div className="flex flex-wrap gap-2" data-testid="profile-interests">
          {profile.interests.map((i) => (
            <Tag key={i}>{i}</Tag>
          ))}
        </div>
      </section>
    )}
    {profile.prompts?.length > 0 && (
      <section>
        <div className="vo-section mb-2">Vibe check</div>
        <div className="space-y-2.5">
          {profile.prompts.map((p, i) => (
            <PromptBlock key={i} prompt={p} name={profile.name} onReact={onReact} />
          ))}
        </div>
      </section>
    )}
  </div>
);

export const ProfileSheet = ({ profile, open, onOpenChange, actions, onBlock, onReport, onReact, note, isSelf = false }) => {
  if (!profile) return null;
  const active = activeLabel(profile.last_active);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[94dvh] max-w-[430px] rounded-t-[24px] border-0 bg-bg" data-testid="profile-sheet">
        <DrawerTitle className="sr-only">{profile.name}</DrawerTitle>
        <DrawerDescription className="sr-only">Profile details</DrawerDescription>
        <div className="vo-scroll px-5 pb-8 pt-2">
          {note && (
            <p className="mb-3 text-center text-[13px] font-medium text-mute" data-testid="profile-sheet-note">
              {note}
            </p>
          )}
          <PhotoCarousel photos={profile.photos} name={profile.name} className="aspect-[4/5] w-full" onReact={onReact} />
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[26px] font-bold leading-none tracking-[-0.02em] text-ink" data-testid="profile-sheet-name">
                {profile.name}
              </h2>
              {profile.age ? <span className="text-[22px] font-medium leading-none text-ink">{profile.age}</span> : null}
              {profile.verified && <VerifiedBadge size={22} onPhoto testId="profile-sheet-verified" />}
            </div>
            {profile.username && (
              <p className="mt-1.5 text-[15px] leading-none text-mute" data-testid="profile-sheet-username">
                @{profile.username}
              </p>
            )}
            <div className="mt-2.5 space-y-1.5 text-[14px] text-mute">
              {profile.job && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" strokeWidth={1.75} /> {profile.job}
                </div>
              )}
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" strokeWidth={1.75} /> {isSelf ? profile.city || "No location set" : distanceLabel(profile.distance_km, profile.city)}
                {active && !isSelf && <span className="ml-1 inline-flex items-center gap-1 text-[12px]"><span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" /> {active}</span>}
              </div>
            </div>
          </div>
          {profile.shared_interests?.length > 0 && !isSelf && (
            <p className="mt-3 text-[13px] text-ink" data-testid="profile-shared">
              You both like {profile.shared_interests.slice(0, 3).join(", ")}
              {profile.shared_interests.length > 3 ? ` +${profile.shared_interests.length - 3} more` : ""}
            </p>
          )}
          <div className="mt-6">
            <ProfileDetails profile={profile} onReact={onReact} />
          </div>
          {actions && <div className="mt-8">{actions}</div>}
          {(onBlock || onReport) && (
            <div className="mt-8 flex items-center justify-center gap-6 text-[13px] font-medium text-mute">
              {onReport && (
                <button type="button" onClick={onReport} className="inline-flex items-center gap-1.5 hover:text-ink" data-testid="profile-report-button">
                  <ShieldAlert className="h-3.5 w-3.5" /> Report
                </button>
              )}
              {onBlock && (
                <button type="button" onClick={onBlock} className="inline-flex items-center gap-1.5 hover:text-red" data-testid="profile-block-button">
                  <Ban className="h-3.5 w-3.5" /> Block
                </button>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
