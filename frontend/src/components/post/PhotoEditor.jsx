import React from "react";
import { RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { FILTERS, ADJUSTMENTS, ASPECTS, DEFAULT_ADJUST, DEFAULT_CROP, cssFilter } from "@/lib/imageEdit";

/*
 * Edit step controls (Instagram layout): a strip of filter thumbnails, an Adjust list of sliders, and Crop aspect chips.
 * The preview itself is the CropView above; these only change the edit state.
 */

export const EditTabs = ({ value, onChange }) => (
  <div className="flex items-center justify-around border-t border-line/70" role="tablist" data-testid="edit-tabs">
    {[
      { id: "filter", label: "Filter" },
      { id: "adjust", label: "Adjust" },
      { id: "crop", label: "Crop" },
    ].map((t) => (
      <button
        key={t.id}
        type="button"
        role="tab"
        aria-selected={value === t.id}
        onClick={() => onChange(t.id)}
        className={`relative flex h-[50px] flex-1 items-center justify-center text-[15.5px] font-semibold tracking-[-0.01em] focus-visible:outline-none active:opacity-70 ${value === t.id ? "text-ink" : "text-mute"}`}
        data-testid={`edit-tab-${t.id}`}
      >
        {t.label}
        {value === t.id && <span className="absolute inset-x-0 top-0 h-[2px] bg-ink" aria-hidden="true" />}
      </button>
    ))}
  </div>
);

export const FilterStrip = ({ src, value, onChange }) => (
  <div className="vo-scroll-x flex gap-3 overflow-x-auto px-4 pb-1 pt-3" style={{ scrollbarWidth: "none" }} data-testid="filter-strip">
    {FILTERS.map((f) => {
      const on = value === f.id;
      return (
        <button key={f.id} type="button" onClick={() => onChange(f.id)} className="flex w-[84px] shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none active:opacity-80" aria-pressed={on} data-testid={`filter-${f.id}`}>
          <span className={`block h-[84px] w-[84px] overflow-hidden rounded-[8px] bg-black ${on ? "ring-2 ring-blue ring-offset-2 ring-offset-transparent" : ""}`}>
            <img src={src} alt="" draggable={false} className="h-full w-full object-cover" style={{ filter: f.css || undefined }} />
          </span>
          <span className={`text-[12.5px] font-semibold tracking-[-0.01em] ${on ? "text-ink" : "text-mute"}`}>{f.name}</span>
        </button>
      );
    })}
  </div>
);

export const AdjustList = ({ value, onChange }) => {
  const a = { ...DEFAULT_ADJUST, ...(value || {}) };
  const dirty = Object.keys(a).some((k) => a[k]);
  return (
    <div className="px-5 pb-2 pt-2" data-testid="adjust-list">
      {ADJUSTMENTS.map((row) => (
        <div key={row.key} className="py-[7px]" data-testid={`adjust-${row.key}`}>
          <div className="mb-1.5 flex items-center justify-between text-[14px] tracking-[-0.01em]">
            <span className="font-semibold text-ink">{row.label}</span>
            <span className={`tabular-nums ${a[row.key] ? "text-ink" : "text-mute"}`} data-testid={`adjust-${row.key}-value`}>
              {a[row.key] > 0 && row.min < 0 ? "+" : ""}
              {a[row.key]}
            </span>
          </div>
          <Slider
            value={[a[row.key]]}
            min={row.min}
            max={row.max}
            step={1}
            onValueChange={([v]) => onChange({ ...a, [row.key]: v })}
            aria-label={row.label}
            className="[&_[role=slider]]:h-[22px] [&_[role=slider]]:w-[22px] [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white [&_[role=slider]]:shadow-[0_1px_4px_rgba(0,0,0,0.35)] [&>span:first-child]:h-[3px] [&>span:first-child]:bg-surface2 [&>span:first-child>span]:bg-ink"
            data-testid={`adjust-${row.key}-slider`}
          />
        </div>
      ))}
      <button type="button" disabled={!dirty} onClick={() => onChange({ ...DEFAULT_ADJUST })} className="mt-2 inline-flex h-[36px] items-center gap-1.5 rounded-full bg-surface2 px-4 text-[14px] font-semibold text-ink disabled:opacity-40 active:opacity-70" data-testid="adjust-reset">
        <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
        Reset
      </button>
    </div>
  );
};

export const CropControls = ({ crop, iw, ih, onChange }) => {
  const isOn = (v) => (v === null ? !crop?.aspect : Math.abs((crop?.aspect || 0) - v) < 0.002);
  const dirty = crop?.zoom !== 1 || crop?.nx || crop?.ny;
  return (
    <div className="px-5 pb-3 pt-4" data-testid="crop-controls">
      <div className="flex items-center gap-2.5">
        {ASPECTS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange({ ...crop, aspect: a.value, zoom: 1, nx: 0, ny: 0 })}
            aria-pressed={isOn(a.value)}
            className={`h-[38px] flex-1 rounded-full text-[14px] font-semibold tracking-[-0.01em] focus-visible:outline-none active:opacity-80 ${isOn(a.value) ? "bg-ink text-onink" : "bg-surface2 text-ink"}`}
            style={{ transitionProperty: "background-color, color", transitionDuration: "150ms" }}
            data-testid={`crop-aspect-${a.id}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="mt-3.5 flex items-center justify-between">
        <p className="text-[13.5px] leading-[18px] text-mute">{crop?.aspect ? "Pinch to zoom, drag to reframe." : "The whole photo is kept, with bars if needed."}</p>
        <button type="button" disabled={!dirty} onClick={() => onChange({ ...crop, zoom: 1, nx: 0, ny: 0 })} className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-surface2 px-3.5 text-[13.5px] font-semibold text-ink disabled:opacity-40 active:opacity-70" data-testid="crop-reset">
          <RotateCcw className="h-[15px] w-[15px]" strokeWidth={2.2} />
          Reset
        </button>
      </div>
    </div>
  );
};

export { cssFilter, DEFAULT_CROP };
