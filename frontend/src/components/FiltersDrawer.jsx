import React, { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { PreferencesForm } from "@/components/PreferencesForm";

export const DEFAULT_PREFS = { age_min: 18, age_max: 30, max_distance_km: 250, show_me: "everyone" };

export const FiltersDrawer = ({ open, onOpenChange, prefs, onApply, saving, anywhereKm = 250 }) => {
  const [draft, setDraft] = useState(prefs || DEFAULT_PREFS);
  useEffect(() => {
    if (open) setDraft(prefs || DEFAULT_PREFS);
  }, [open, prefs]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-[430px] rounded-t-[28px] border-line bg-white px-5 pb-6" data-testid="filters-drawer">
        <DrawerTitle className="vo-h2 mt-3">Who do you want to see?</DrawerTitle>
        <DrawerDescription className="mb-6 mt-1 text-[14px] text-mute">Fine-tune your feed. You can change this anytime.</DrawerDescription>
        <PreferencesForm value={draft} onChange={setDraft} anywhereKm={anywhereKm} />
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            className="vo-btn-secondary flex-1"
            data-testid="filters-reset-button"
            onClick={() => setDraft({ ...DEFAULT_PREFS, show_me: draft.show_me })}
          >
            Reset
          </button>
          <button type="button" className="vo-btn-primary flex-[2]" data-testid="filters-apply-button" disabled={saving} onClick={() => onApply(draft)}>
            {saving ? "Saving..." : "Show me people"}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
