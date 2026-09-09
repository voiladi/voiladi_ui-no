import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, LocateFixed, Check, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Chip } from "@/components/Chip";
import { Segmented } from "@/components/PreferencesForm";
import { genderLabel, showMeLabel } from "@/lib/format";

/* ---------------- Birthday ---------------- */
export const parseBirthday = ({ d, m, y }) => {
  const dd = parseInt(d, 10);
  const mm = parseInt(m, 10);
  const yy = parseInt(y, 10);
  if (!dd || !mm || !yy || String(y).length !== 4) return null;
  const date = new Date(yy, mm - 1, dd);
  if (date.getFullYear() !== yy || date.getMonth() !== mm - 1 || date.getDate() !== dd) return null;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
};

export const ageFromIso = (iso) => {
  if (!iso) return null;
  const b = new Date(iso);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const md = t.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && t.getDate() < b.getDate())) a -= 1;
  return a;
};

export const BirthdayInput = ({ value, onChange }) => {
  const mRef = useRef(null);
  const yRef = useRef(null);
  const set = (k, v, max, next) => {
    const clean = v.replace(/\D/g, "").slice(0, max);
    onChange({ ...value, [k]: clean });
    if (clean.length === max && next?.current) next.current.focus();
  };
  const iso = parseBirthday(value);
  const age = ageFromIso(iso);
  const filled = value.d?.length === 2 && value.m?.length === 2 && value.y?.length === 4;
  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          inputMode="numeric"
          placeholder="DD"
          value={value.d || ""}
          onChange={(e) => set("d", e.target.value, 2, mRef)}
          className="vo-input w-[84px] text-center font-display text-[22px] font-semibold"
          data-testid="onboarding-birthday-day"
          aria-label="Day"
        />
        <span className="text-mute">/</span>
        <input
          ref={mRef}
          inputMode="numeric"
          placeholder="MM"
          value={value.m || ""}
          onChange={(e) => set("m", e.target.value, 2, yRef)}
          className="vo-input w-[84px] text-center font-display text-[22px] font-semibold"
          data-testid="onboarding-birthday-month"
          aria-label="Month"
        />
        <span className="text-mute">/</span>
        <input
          ref={yRef}
          inputMode="numeric"
          placeholder="YYYY"
          value={value.y || ""}
          onChange={(e) => set("y", e.target.value, 4)}
          className="vo-input flex-1 text-center font-display text-[22px] font-semibold"
          data-testid="onboarding-birthday-year"
          aria-label="Year"
        />
      </div>
      <div className="mt-3 min-h-[22px] text-[14px]" data-testid="onboarding-birthday-feedback">
        {filled && !iso && <span className="text-danger">That date doesn't exist. Double-check it.</span>}
        {iso && age !== null && age < 18 && <span className="text-danger">You need to be 18 or older to join Voiladi.</span>}
        {iso && age !== null && age > 100 && <span className="text-danger">Hmm, that doesn't look right.</span>}
        {iso && age !== null && age >= 18 && age <= 100 && (
          <span className="text-tint">
            You're <span className="font-semibold">{age}</span>. This is shown on your profile, your birthday isn't.
          </span>
        )}
      </div>
    </div>
  );
};

/* ---------------- Gender / looking for ---------------- */
export const OptionList = ({ options, value, onChange, render, testIdPrefix }) => (
  <div className="space-y-2.5">
    {options.map((o) => {
      const on = o === value;
      return (
        <button key={o} type="button" onClick={() => onChange(o)} className={`vo-option ${on ? "vo-option-on" : ""}`} data-testid={`${testIdPrefix}-${o}`} aria-pressed={on}>
          {render ? render(o) : o}
          <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${on ? "border-tint bg-tint text-white" : "border-line"}`}>
            {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
        </button>
      );
    })}
  </div>
);

export const GenderSegment = ({ value, onChange }) => <Segmented options={["woman", "man", "nonbinary"]} value={value} onChange={onChange} testIdPrefix="gender" render={genderLabel} />;
export const LookingSegment = ({ value, onChange }) => <Segmented options={["women", "men", "everyone"]} value={value} onChange={onChange} testIdPrefix="looking" render={showMeLabel} />;

/* ---------------- Interests ---------------- */
export const InterestPicker = ({ all = [], value = [], onChange, min = 3, max = 10 }) => {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? all.filter((i) => i.toLowerCase().includes(s)) : all;
    return base;
  }, [q, all]);
  const toggle = (i) => {
    if (value.includes(i)) onChange(value.filter((x) => x !== i));
    else if (value.length >= max) toast(`You can pick up to ${max}`);
    else onChange([...value, i]);
  };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input className="vo-input h-11 pl-11 text-[15px]" style={{ height: 44 }} placeholder="Search interests" value={q} onChange={(e) => setQ(e.target.value)} data-testid="interests-search-input" />
        </div>
        <span className={`ml-3 font-display text-[15px] font-semibold ${value.length >= min ? "text-tint" : "text-mute"}`} data-testid="interests-count">
          {value.length}/{max}
        </span>
      </div>
      <div className="flex flex-wrap gap-2" data-testid="interests-list">
        {list.map((i) => (
          <Chip key={i} active={value.includes(i)} onClick={() => toggle(i)} data-testid={`interest-chip-${i.replace(/\s+/g, "-").toLowerCase()}`}>
            {i}
          </Chip>
        ))}
        {list.length === 0 && <p className="text-[14px] text-mute">Nothing matches "{q}".</p>}
      </div>
    </div>
  );
};

/* ---------------- Prompts ---------------- */
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
    <div className="space-y-3" data-testid="prompt-editor">
      {value.map((p, i) => (
        <div key={p.question} className="rounded-card border border-line bg-white p-4" data-testid={`prompt-card-${i}`}>
          <div className="mb-2 flex items-start justify-between gap-3">
            <button type="button" onClick={() => setPicking(picking === i ? false : i)} className="text-left text-[13px] font-medium text-tint" data-testid={`prompt-change-${i}`}>
              {p.question}
            </button>
            <button type="button" onClick={() => remove(i)} className="vo-icon-btn h-8 w-8 border-0 bg-surface2" aria-label="Remove prompt" data-testid={`prompt-remove-${i}`}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            className="vo-textarea min-h-[84px] px-3 py-2.5 font-display text-[17px]"
            placeholder="Your answer..."
            maxLength={200}
            value={p.answer}
            onChange={(e) => update(i, { answer: e.target.value })}
            data-testid={`prompt-answer-${i}`}
          />
          <div className="mt-1 text-right text-[12px] text-mute">{p.answer.length}/200</div>
        </div>
      ))}
      {picking !== false ? (
        <div className="rounded-card border border-line bg-white p-3" data-testid="prompt-picker">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[13px] font-semibold text-ink">{typeof picking === "number" ? "Swap the question" : "Pick a prompt"}</span>
            <button type="button" className="text-[13px] font-semibold text-mute hover:text-ink" onClick={() => setPicking(false)} data-testid="prompt-picker-cancel">
              Cancel
            </button>
          </div>
          <div className="max-h-[320px] space-y-1.5 overflow-y-auto no-scrollbar">
            {options.map((q, idx) => (
              <button key={q} type="button" onClick={() => choose(q)} className="vo-option py-3 text-[15px]" data-testid={`prompt-option-${idx}`} data-prompt-option="true">
                {q}...
                <Plus className="h-4 w-4 text-mute" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        value.length < max && (
          <button type="button" onClick={() => setPicking(true)} className="vo-option justify-center gap-2 border-dashed text-mute" data-testid="prompt-add-button">
            <Plus className="h-5 w-5" /> {value.length ? "Add another prompt" : "Pick a prompt"}
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
    if (!s) return cities.slice(0, 12);
    return cities.filter((c) => c.name.toLowerCase().includes(s) || c.country.toLowerCase().includes(s)).slice(0, 12);
  }, [q, cities]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device");
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
        toast.error("Couldn't get your location. Pick a city instead.");
      },
      { timeout: 10000 }
    );
  };

  return (
    <div data-testid="location-picker">
      <button type="button" onClick={useMyLocation} disabled={locating} className="vo-option mb-4 text-tint" data-testid="location-use-current-button">
        <span className="flex items-center gap-2.5">
          {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
          {locating ? "Finding you..." : "Use my current location"}
        </span>
      </button>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
        <input className="vo-input pl-11" style={{ height: 48 }} placeholder="Or search your city" value={q} onChange={(e) => setQ(e.target.value)} data-testid="location-search-input" />
      </div>
      {value?.city && (
        <div className="mb-3 flex items-center justify-between rounded-btn bg-surface2 px-4 py-3 text-[14px]" data-testid="location-selected">
          <span>
            Showing you in <span className="font-semibold text-ink">{value.city}</span>
          </span>
          <button type="button" className="text-[13px] font-semibold text-mute hover:text-danger" onClick={() => onChange({ city: "", lat: null, lng: null })} data-testid="location-clear-button">
            Clear
          </button>
        </div>
      )}
      <div className="max-h-[300px] space-y-1.5 overflow-y-auto no-scrollbar">
        {list.map((c) => {
          const on = value?.city === c.name;
          return (
            <button key={`${c.name}-${c.country}`} type="button" onClick={() => onChange({ city: c.name, lat: c.lat, lng: c.lng })} className={`vo-option py-3 ${on ? "vo-option-on" : ""}`} data-testid={`city-option-${c.name.replace(/\s+/g, "-").toLowerCase()}`}>
              <span>
                {c.name} <span className="ml-1 text-[13px] font-normal text-mute">{c.country}</span>
              </span>
              {on && <Check className="h-5 w-5 text-tint" strokeWidth={2.5} />}
            </button>
          );
        })}
        {list.length === 0 && <p className="px-1 text-[14px] text-mute">No city found. Try "Use my current location".</p>}
      </div>
    </div>
  );
};

export const useDebouncedEffect = (fn, deps, ms) => {
  useEffect(() => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
