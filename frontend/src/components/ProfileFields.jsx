import React, { useMemo, useState } from "react";
import { Search, LocateFixed, Check, Plus, X } from "lucide-react";
import { Spinner } from "@/components/Loading";
import { notice } from "@/lib/feedback";

/* ---------------- Prompts ("Vibe check") ---------------- */
export const PromptEditor = ({ questions = [], value = [], onChange, max = 3 }) => {
  const [picking, setPicking] = useState(false); // false | true (add) | index (replace question)
  const used = new Set(value.map((p) => p.question));
  const options = typeof picking === "number" ? questions.filter((q) => !used.has(q) || q === value[picking]?.question) : questions.filter((q) => !used.has(q));
  const update = (i, patch) => onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const choose = (q) => {
    if (typeof picking === "number") update(picking, { question: q });
    else onChange([...value, { question: q, answer: "" }]);
    setPicking(false);
  };
  return (
    <div className="space-y-2.5" data-testid="prompt-editor">
      {value.map((p, i) => (
        <div key={p.question} className="rounded-[14px] bg-bg p-3" data-testid={`prompt-card-${i}`}>
          <div className="mb-2 flex items-start justify-between gap-3">
            <button type="button" onClick={() => setPicking(picking === i ? false : i)} className="text-left text-[12px] font-semibold text-mute hover:text-ink" data-testid={`prompt-change-${i}`}>
              {p.question}
            </button>
            <button type="button" onClick={() => remove(i)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-ink" aria-label="Remove prompt" data-testid={`prompt-remove-${i}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea className="vo-textarea min-h-[76px] px-3 py-2.5 text-[15px]" placeholder="Your answer..." maxLength={200} value={p.answer} onChange={(e) => update(i, { answer: e.target.value })} data-testid={`prompt-answer-${i}`} />
          <div className="mt-1 text-right text-[11px] text-mute">{p.answer.length}/200</div>
        </div>
      ))}
      {picking !== false ? (
        <div className="rounded-[14px] bg-bg p-2" data-testid="prompt-picker">
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <span className="text-[13px] font-semibold text-ink">{typeof picking === "number" ? "Swap the question" : "Pick a prompt"}</span>
            <button type="button" className="text-[13px] font-medium text-mute hover:text-ink" onClick={() => setPicking(false)} data-testid="prompt-picker-cancel">
              Cancel
            </button>
          </div>
          <div className="no-scrollbar max-h-[280px] overflow-y-auto">
            {options.map((q, idx) => (
              <button key={q} type="button" onClick={() => choose(q)} className="flex w-full items-center justify-between rounded-[10px] px-2 py-2.5 text-left text-[14px] text-ink hover:bg-surface" data-testid={`prompt-option-${idx}`} data-prompt-option="true">
                {q}...
                <Plus className="h-4 w-4 text-mute" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        value.length < max && (
          <button type="button" onClick={() => setPicking(true)} className="vo-btn-secondary h-11 w-full text-[14px]" data-testid="prompt-add-button">
            <Plus className="h-4 w-4" /> {value.length ? "Add another prompt" : "Pick a prompt"}
          </button>
        )
      )}
    </div>
  );
};

/* ---------------- Location ---------------- */
const haversine = (a, b, c, d) => {
  const R = 6371;
  const toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(c - a);
  const dLng = toR(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const LocationPicker = ({ cities = [], value, onChange }) => {
  const [q, setQ] = useState("");
  const [locating, setLocating] = useState(false);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return cities.slice(0, 8);
    return cities.filter((c) => c.name.toLowerCase().includes(s) || c.country.toLowerCase().includes(s)).slice(0, 8);
  }, [q, cities]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      notice("Location isn't available on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let best = null;
        let bestD = Infinity;
        cities.forEach((c) => {
          const d = haversine(latitude, longitude, c.lat, c.lng);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        });
        const city = best && bestD < 80 ? best.name : best ? `Near ${best.name}` : "My location";
        onChange({ city, lat: latitude, lng: longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        notice("Couldn't get your location. Pick a city instead.");
      },
      { timeout: 10000 }
    );
  };

  return (
    <div data-testid="location-picker">
      <button type="button" onClick={useMyLocation} disabled={locating} className="vo-btn-secondary mb-3 h-11 w-full justify-start px-4 text-[14px]" data-testid="location-use-current-button">
        {locating ? <Spinner size={16} stroke={2} /> : <LocateFixed className="h-4 w-4" />}
        {locating ? "Finding you..." : "Use my current location"}
      </button>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
        <input className="vo-input bg-bg pl-11" placeholder="Search your city" value={q} onChange={(e) => setQ(e.target.value)} data-testid="location-search-input" />
      </div>
      {value?.city && (
        <div className="mb-2 flex items-center justify-between px-1 text-[13px] text-mute" data-testid="location-selected">
          <span>
            Showing you in <span className="font-semibold text-ink">{value.city}</span>
          </span>
          <button type="button" className="font-medium text-red" onClick={() => onChange({ city: "", lat: null, lng: null })} data-testid="location-clear-button">
            Clear
          </button>
        </div>
      )}
      <div className="no-scrollbar max-h-[240px] overflow-y-auto rounded-[12px] bg-bg">
        {list.map((c) => {
          const on = value?.city === c.name;
          return (
            <button key={`${c.name}-${c.country}`} type="button" onClick={() => onChange({ city: c.name, lat: c.lat, lng: c.lng })} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[14px] text-ink hover:bg-surface" data-testid={`city-option-${c.name.replace(/\s+/g, "-").toLowerCase()}`}>
              <span>
                {c.name} <span className="ml-1 text-[12px] text-mute">{c.country}</span>
              </span>
              {on && <Check className="h-4 w-4" strokeWidth={2.5} />}
            </button>
          );
        })}
        {list.length === 0 && <p className="px-3 py-3 text-[13px] text-mute">No city found. Try "Use my current location".</p>}
      </div>
    </div>
  );
};
