import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { PhotoGrid } from "@/components/PhotoGrid";
import { BirthdayInput, GenderSegment, InterestPicker, PromptEditor, LocationPicker, parseBirthday, ageFromIso } from "@/components/ProfileFields";

const splitBirthday = (iso) => {
  if (!iso) return { d: "", m: "", y: "" };
  const [y, m, d] = iso.split("-");
  return { d, m, y };
};

const Section = ({ title, hint, children }) => (
  <section className="px-5 pt-7">
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="font-display text-[18px] font-semibold text-ink">{title}</h3>
      {hint && <span className="text-[12px] text-mute">{hint}</span>}
    </div>
    {children}
  </section>
);

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { meta } = useMeta();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    bday: splitBirthday(user?.birthday),
    gender: user?.gender || "",
    bio: user?.bio || "",
    interests: user?.interests || [],
    prompts: user?.prompts || [],
    location: { city: user?.city || "", lat: user?.lat ?? null, lng: user?.lng ?? null },
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const birthdayIso = parseBirthday(form.bday);
  const age = ageFromIso(birthdayIso);
  const valid = form.name.trim().length >= 1 && birthdayIso && age >= 18 && age <= 100 && form.gender && form.interests.length >= 3 && form.prompts.every((p) => p.answer.trim());

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const { data } = await api.put("/profile", {
        name: form.name.trim(),
        birthday: birthdayIso,
        gender: form.gender,
        bio: form.bio.trim(),
        interests: form.interests,
        prompts: form.prompts.filter((p) => p.answer.trim()),
        city: form.location.city || "",
        lat: form.location.lat,
        lng: form.location.lng,
        clear_location: !form.location.city,
      });
      setUser(data);
      toast.success("Profile saved");
      navigate("/profile");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col" data-testid="edit-profile-page">
      <header className="vo-bar sticky top-0 z-20 flex items-center justify-between border-b border-line px-3 py-2.5">
        <button type="button" className="vo-icon-btn bg-transparent" onClick={() => navigate("/profile")} aria-label="Back" data-testid="edit-back-button">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-[18px] font-semibold text-ink">Edit profile</h1>
        <button type="button" className="vo-btn-text h-10 text-[16px]" disabled={!valid || saving} onClick={save} data-testid="edit-save-button">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save"}
        </button>
      </header>

      <div className="flex-1 pb-32">
        <Section title="Photos" hint="Tap to remove or make cover">
          <PhotoGrid photos={user?.photos || []} onChange={(photos) => setUser((u) => ({ ...u, photos }))} max={meta.max_photos} />
        </Section>

        <Section title="Name">
          <input className="vo-input font-display text-[20px] font-semibold" maxLength={30} value={form.name} onChange={(e) => set({ name: e.target.value })} data-testid="edit-name-input" />
        </Section>

        <Section title="Birthday">
          <BirthdayInput value={form.bday} onChange={(bday) => set({ bday })} />
        </Section>

        <Section title="I am a">
          <GenderSegment value={form.gender} onChange={(gender) => set({ gender })} />
        </Section>

        <Section title="Bio" hint={`${form.bio.length}/300`}>
          <textarea className="vo-textarea min-h-[110px]" maxLength={300} placeholder="Two sentences that sound like you..." value={form.bio} onChange={(e) => set({ bio: e.target.value })} data-testid="edit-bio-input" />
        </Section>

        <Section title="Interests" hint="Pick 3 to 10">
          <InterestPicker all={meta.interests} value={form.interests} onChange={(interests) => set({ interests })} />
        </Section>

        <Section title="Vibe check" hint="Up to 3 prompts">
          <PromptEditor questions={meta.prompts} value={form.prompts} onChange={(prompts) => set({ prompts })} />
        </Section>

        <Section title="Location">
          <LocationPicker cities={meta.cities} value={form.location} onChange={(location) => set({ location })} />
        </Section>
      </div>

      <div className="vo-bar sticky bottom-0 z-20 border-t border-line px-5 pt-3" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        <button type="button" className="vo-btn-primary w-full" disabled={!valid || saving} onClick={save} data-testid="edit-save-bottom-button">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save changes"}
        </button>
      </div>
    </div>
  );
}
