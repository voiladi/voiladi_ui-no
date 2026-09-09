import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { PreferencesForm } from "@/components/PreferencesForm";
import { DEFAULT_PREFS } from "@/components/FiltersDrawer";

export default function Preferences() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { meta } = useMeta();
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFS, ...(user?.preferences || {}) });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/preferences", prefs);
      setUser((u) => ({ ...u, preferences: data, looking_for: data.show_me }));
      toast.success("Preferences saved");
      navigate("/profile");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col" data-testid="preferences-page">
      <header className="vo-bar sticky top-0 z-20 flex items-center justify-between border-b border-line px-3 py-2.5">
        <button type="button" className="vo-icon-btn bg-transparent" onClick={() => navigate("/profile")} aria-label="Back" data-testid="prefs-back-button">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-[18px] font-semibold text-ink">Discovery</h1>
        <span className="w-10" />
      </header>
      <div className="flex-1 px-5 pb-32 pt-7">
        <p className="mb-7 text-[15px] text-mute">Control who shows up in your feed. You'll only see people who want to see you too.</p>
        <PreferencesForm value={prefs} onChange={setPrefs} anywhereKm={meta.anywhere_km} />
      </div>
      <div className="vo-bar sticky bottom-0 z-20 border-t border-line px-5 pt-3" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        <button type="button" className="vo-btn-primary w-full" disabled={saving} onClick={save} data-testid="prefs-save-button">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save preferences"}
        </button>
      </div>
    </div>
  );
}
