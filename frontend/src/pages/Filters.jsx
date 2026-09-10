import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Spinner } from "@/components/Loading";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { ModalHeader } from "@/components/EmptyState";
import { Chip, Segmented } from "@/components/Chip";
import { showMeLabel } from "@/lib/format";

export const DEFAULT_PREFS = { age_min: 18, age_max: 30, max_distance_km: 250, show_me: "everyone", interests: [], goals: [] };

const SliderKnob = () => <SliderPrimitive.Thumb className="block h-6 w-6 rounded-full bg-white shadow-thumb focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue" />;

export const RangeSlider = ({ value, onValueChange, min, max, step = 1, testId, thumbs = 2 }) => (
  <SliderPrimitive.Root value={value} onValueChange={onValueChange} min={min} max={max} step={step} minStepsBetweenThumbs={1} className="relative flex h-8 w-full touch-none select-none items-center" data-testid={testId}>
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-surface2">
      <SliderPrimitive.Range className="absolute h-full bg-ink" />
    </SliderPrimitive.Track>
    {Array.from({ length: thumbs }).map((_, i) => (
      <SliderKnob key={i} />
    ))}
  </SliderPrimitive.Root>
);

const Head = ({ label, value, testId }) => (
  <div className="mb-3 flex items-baseline justify-between">
    <span className="text-[17px] font-semibold text-ink">{label}</span>
    {value !== undefined && (
      <span className="text-[16px] font-semibold text-ink" data-testid={testId}>
        {value}
      </span>
    )}
  </div>
);

export default function Filters() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { meta } = useMeta();
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFS, ...(user?.preferences || {}) });
  const [saving, setSaving] = useState(false);
  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));
  const anywhere = meta.anywhere_km || 250;
  const distance =
    prefs.max_distance_km >= anywhere ? (
      "Anywhere"
    ) : (
      <>
        <span className="font-normal">Up to </span>
        <span className="font-bold">{prefs.max_distance_km} km</span>
      </>
    );

  const apply = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/preferences", prefs);
      setUser((u) => ({ ...u, preferences: data, looking_for: data.show_me }));
      navigate(-1);
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleIn = (key, v) => set({ [key]: prefs[key].includes(v) ? prefs[key].filter((x) => x !== v) : [...prefs[key], v] });

  return (
    <div className="flex min-h-full flex-col" data-testid="preferences-page">
      <ModalHeader
        left={
          <button type="button" className="text-[16px] text-ink" onClick={() => navigate(-1)} data-testid="prefs-back-button">
            Cancel
          </button>
        }
        title="Filters"
        right={
          <button type="button" className="text-[16px] font-semibold text-ink" onClick={() => setPrefs({ ...DEFAULT_PREFS })} data-testid="filters-reset-button">
            Reset
          </button>
        }
      />

      <div className="flex-1 divide-y divide-line px-5 pb-32 pt-2 [&>section]:py-6 [&>section:first-child]:pt-2">
        <section>
          <Head label="Show me" />
          <Segmented options={["women", "men", "everyone"]} value={prefs.show_me} onChange={(v) => set({ show_me: v })} render={showMeLabel} testIdPrefix="prefs-show-me" />
        </section>

        <section>
          <Head label="Age range" value={`${prefs.age_min} \u2013 ${prefs.age_max}`} testId="prefs-age-label" />
          <RangeSlider value={[prefs.age_min, prefs.age_max]} onValueChange={([a, b]) => set({ age_min: a, age_max: b })} min={18} max={60} testId="filters-age-slider" />
        </section>

        <section>
          <Head label="Distance" value={distance} testId="prefs-distance-label" />
          <RangeSlider value={[prefs.max_distance_km]} onValueChange={([d]) => set({ max_distance_km: d })} min={5} max={anywhere} step={5} thumbs={1} testId="filters-distance-slider" />
        </section>

        <section>
          <Head label="Interests" />
          <div className="flex flex-wrap gap-3" data-testid="filters-interests">
            {meta.interests.slice(0, 14).map((i) => (
              <Chip key={i} active={prefs.interests.includes(i)} className="h-11 px-6" onClick={() => toggleIn("interests", i)} data-testid={`filter-interest-${i.replace(/\s+/g, "-").toLowerCase()}`}>
                {i}
              </Chip>
            ))}
          </div>
        </section>

        <section>
          <Head label="Relationship goals" />
          <div className="flex flex-wrap gap-3" data-testid="filters-goals">
            {meta.goals.map((g) => (
              <Chip key={g} active={prefs.goals.includes(g)} className="h-11 px-6" onClick={() => toggleIn("goals", g)} data-testid={`filter-goal-${g.replace(/\s+/g, "-").toLowerCase()}`}>
                {g}
              </Chip>
            ))}
          </div>
        </section>
      </div>

      <div className="vo-bar sticky bottom-0 z-20 px-5 pt-3" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        <button type="button" className="vo-btn-primary w-full" disabled={saving} aria-busy={saving} onClick={apply} data-testid="filters-apply-button">
          {saving ? <Spinner size={20} stroke={2} /> : "Apply"}
        </button>
      </div>
    </div>
  );
}
