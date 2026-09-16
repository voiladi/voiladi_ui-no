import React, { useEffect, useMemo, useState } from "react";
import { MapPin, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { SoftSearch } from "@/components/SoftUI";

export const LOCATION_MAX = 80;

/*
 * "Add location" (Instagram): type a place, pick it from the list. Suggestions are your city and places you've used
 * before; whatever you type can be used as-is.
 */
export const LocationSheet = ({ open, onOpenChange, value = "", onChange, suggestions = [] }) => {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const list = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of suggestions) {
      const v = (s || "").trim();
      const k = v.toLowerCase();
      if (v && !seen.has(k) && (!q.trim() || k.includes(q.trim().toLowerCase()))) {
        seen.add(k);
        out.push(v);
      }
    }
    return out.slice(0, 12);
  }, [suggestions, q]);

  const typed = q.trim().slice(0, LOCATION_MAX);
  const showTyped = typed && !list.some((v) => v.toLowerCase() === typed.toLowerCase());

  const choose = (v) => {
    onChange(v);
    onOpenChange(false);
  };

  const Row = ({ label, sub, onClick, danger, testId }) => (
    <button type="button" onClick={onClick} className="flex h-[60px] w-full items-center gap-3 text-left focus-visible:outline-none active:opacity-80" data-testid={testId}>
      <span className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full ${danger ? "bg-red/10 text-red" : "bg-surface2 text-ink"}`}>
        {danger ? <X className="h-[20px] w-[20px]" strokeWidth={2.2} /> : <MapPin className="h-[20px] w-[20px]" strokeWidth={2} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15.5px] font-semibold tracking-[-0.01em] ${danger ? "text-red" : "text-ink"}`}>{label}</span>
        {sub && <span className="block truncate text-[13.5px] text-mute">{sub}</span>}
      </span>
    </button>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto h-[80dvh] max-w-[430px] rounded-t-[28px] border-0 bg-canvas [&>div:first-child]:hidden" data-testid="location-sheet">
        <div className="mx-auto mt-3 h-[5px] w-12 shrink-0 rounded-full bg-surface2" aria-hidden="true" />
        <div className="flex min-h-0 flex-1 flex-col pb-[calc(8px+var(--safe-bottom))]">
          <div className="flex h-[52px] shrink-0 items-center justify-center px-5">
            <DrawerTitle className="text-[17px] font-bold tracking-[-0.01em] text-ink">Add location</DrawerTitle>
            <DrawerDescription className="sr-only">Type a place for this post</DrawerDescription>
          </div>
          <div className="px-5">
            <SoftSearch value={q} onChange={(v) => setQ(v.slice(0, LOCATION_MAX))} onClear={() => setQ("")} placeholder="Search places" testId="location-search" />
          </div>
          <div className="vo-scroll mt-2 min-h-0 flex-1 overflow-y-auto px-5 pb-4" data-testid="location-list">
            {value && !q && <Row label="Remove location" onClick={() => choose("")} danger testId="location-remove" />}
            {showTyped && <Row label={typed} sub="Use this place" onClick={() => choose(typed)} testId="location-use-typed" />}
            {list.map((v) => (
              <Row key={v} label={v} sub={v === value ? "Current" : undefined} onClick={() => choose(v)} testId="location-suggestion" />
            ))}
            {!showTyped && list.length === 0 && !value && (
              <p className="mt-14 px-6 text-center text-[14.5px] leading-[19px] text-mute" data-testid="location-empty">
                Type the name of a place - a city, a cafe, a beach - and tap it to add.
              </p>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
