import React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { MapPin, Users } from "lucide-react";
import { showMeLabel } from "@/lib/format";

const SliderThumb = () => (
  <SliderPrimitive.Thumb className="block h-7 w-7 rounded-full border-[3px] border-brand bg-white shadow-[0_4px_14px_rgba(11,18,32,0.18)] transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft active:scale-110" />
);

export const RangeSlider = ({ value, onValueChange, min, max, step = 1, testId, thumbs = 2 }) => (
  <SliderPrimitive.Root
    value={value}
    onValueChange={onValueChange}
    min={min}
    max={max}
    step={step}
    minStepsBetweenThumbs={1}
    className="relative flex h-8 w-full touch-none select-none items-center"
    data-testid={testId}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-surface2">
      <SliderPrimitive.Range className="absolute h-full bg-brand" />
    </SliderPrimitive.Track>
    {Array.from({ length: thumbs }).map((_, i) => (
      <SliderThumb key={i} />
    ))}
  </SliderPrimitive.Root>
);

export const Segmented = ({ options, value, onChange, testIdPrefix = "segment", render }) => (
  <div className="grid rounded-[16px] bg-surface2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
    {options.map((o) => {
      const active = o === value;
      return (
        <button
          key={o}
          type="button"
          data-testid={`${testIdPrefix}-${o}`}
          onClick={() => onChange(o)}
          aria-pressed={active}
          className={`h-11 rounded-[12px] text-[14px] font-semibold transition-colors duration-150 ${
            active ? "bg-white text-ink shadow-[0_4px_14px_rgba(11,18,32,0.08)]" : "text-mute hover:text-ink"
          }`}
        >
          {render ? render(o) : o}
        </button>
      );
    })}
  </div>
);

export const PreferencesForm = ({ value, onChange, anywhereKm = 250 }) => {
  const set = (patch) => onChange({ ...value, ...patch });
  const distanceLabel = value.max_distance_km >= anywhereKm ? "Anywhere" : `${value.max_distance_km} km`;
  return (
    <div className="space-y-7">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-mute" />
            <span className="text-[15px] font-semibold text-ink">Show me</span>
          </div>
        </div>
        <Segmented options={["women", "men", "everyone"]} value={value.show_me} onChange={(v) => set({ show_me: v })} testIdPrefix="prefs-show-me" render={showMeLabel} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-semibold text-ink">Age range</span>
          <span className="font-display text-[15px] font-semibold text-brand-dark" data-testid="prefs-age-label">
            {value.age_min} - {value.age_max}
          </span>
        </div>
        <RangeSlider
          value={[value.age_min, value.age_max]}
          onValueChange={([a, b]) => set({ age_min: a, age_max: b })}
          min={18}
          max={60}
          testId="filters-age-slider"
        />
        <div className="mt-1 flex justify-between text-[12px] text-mute">
          <span>18</span>
          <span>60</span>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-mute" />
            <span className="text-[15px] font-semibold text-ink">Max distance</span>
          </div>
          <span className="font-display text-[15px] font-semibold text-brand-dark" data-testid="prefs-distance-label">
            {distanceLabel}
          </span>
        </div>
        <RangeSlider
          value={[value.max_distance_km]}
          onValueChange={([d]) => set({ max_distance_km: d })}
          min={5}
          max={anywhereKm}
          step={5}
          thumbs={1}
          testId="filters-distance-slider"
        />
        <div className="mt-1 flex justify-between text-[12px] text-mute">
          <span>5 km</span>
          <span>Anywhere</span>
        </div>
      </section>
    </div>
  );
};
