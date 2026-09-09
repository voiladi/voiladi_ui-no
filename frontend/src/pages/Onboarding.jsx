import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { PhotoGrid } from "@/components/PhotoGrid";
import { BirthdayInput, OptionList, InterestPicker, PromptEditor, LocationPicker, parseBirthday, ageFromIso } from "@/components/ProfileFields";
import { genderLabel, showMeLabel } from "@/lib/format";

const STEPS = ["name", "birthday", "gender", "looking", "photos", "interests", "prompts", "about"];

const splitBirthday = (iso) => {
  if (!iso) return { d: "", m: "", y: "" };
  const [y, m, d] = iso.split("-");
  return { d, m, y };
};

export default function Onboarding() {
  const { user, setUser, refresh } = useAuth();
  const { meta } = useMeta();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    name: user?.name || "",
    bday: splitBirthday(user?.birthday),
    gender: user?.gender || "",
    looking_for: user?.looking_for || "",
    photos: user?.photos || [],
    interests: user?.interests || [],
    prompts: user?.prompts || [],
    bio: user?.bio || "",
    location: { city: user?.city || "", lat: user?.lat ?? null, lng: user?.lng ?? null },
  }));
  const step = STEPS[i];
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const birthdayIso = parseBirthday(form.bday);
  const age = ageFromIso(birthdayIso);

  const valid = useMemo(() => {
    switch (step) {
      case "name":
        return form.name.trim().length >= 1 && form.name.trim().length <= 30;
      case "birthday":
        return !!birthdayIso && age >= 18 && age <= 100;
      case "gender":
        return !!form.gender;
      case "looking":
        return !!form.looking_for;
      case "photos":
        return form.photos.length >= 1;
      case "interests":
        return form.interests.length >= 3;
      case "prompts":
        return form.prompts.length >= 1 && form.prompts.every((p) => p.answer.trim().length > 0);
      default:
        return true;
    }
  }, [step, form, birthdayIso, age]);

  const payloadFor = (s) => {
    switch (s) {
      case "name":
        return { name: form.name.trim() };
      case "birthday":
        return { birthday: birthdayIso };
      case "gender":
        return { gender: form.gender };
      case "looking":
        return { looking_for: form.looking_for };
      case "interests":
        return { interests: form.interests };
      case "prompts":
        return { prompts: form.prompts.filter((p) => p.answer.trim()) };
      case "about":
        return {
          bio: form.bio.trim(),
          city: form.location.city || "",
          lat: form.location.lat,
          lng: form.location.lng,
          clear_location: !form.location.city,
          onboarded: true,
        };
      default:
        return null;
    }
  };

  const next = async () => {
    if (!valid || saving) return;
    const payload = payloadFor(step);
    if (payload) {
      setSaving(true);
      try {
        const { data } = await api.put("/profile", payload);
        setUser(data);
        if (step === "about") {
          if (data.profile_complete && data.onboarded) {
            toast.success(`You're in, ${data.name}. Let's find your people.`);
            await refresh();
            return;
          }
          toast.error("Something's missing. Add at least one photo and three interests.");
          setSaving(false);
          return;
        }
      } catch (e) {
        toast.error(errMsg(e));
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setDir(1);
    setI((x) => Math.min(STEPS.length - 1, x + 1));
  };

  const back = () => {
    setDir(-1);
    setI((x) => Math.max(0, x - 1));
  };

  const titles = {
    name: ["First things first", "What should we call you?", "This is how you'll appear on Voiladi."],
    birthday: ["Just checking", "When's your birthday?", "You have to be 18+ to be here."],
    gender: ["About you", "How do you identify?", "You can change this later in your profile."],
    looking: ["Your feed", "Who do you want to meet?", "We'll show you people who want to meet you too."],
    photos: ["Show yourself", "Add your photos", "Profiles with 3+ photos get way more matches. Add at least one."],
    interests: ["Your thing", "What are you into?", "Pick at least 3. We use these to find your people."],
    prompts: ["Vibe check", "Answer a prompt or three", "This is what people actually read. Make it you."],
    about: ["Last one", "A little more about you", "Optional, but it helps people say hi."],
  };
  const [eyebrow, title, sub] = titles[step];
  const progress = ((i + 1) / STEPS.length) * 100;

  return (
    <div className="flex min-h-full flex-col" data-testid="onboarding-wizard">
      <div className="sticky top-0 z-20 border-b border-line bg-[rgba(251,251,252,0.95)] px-5 pb-3 pt-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button type="button" onClick={back} disabled={i === 0} className="vo-icon-btn disabled:opacity-30" aria-label="Back" data-testid="onboarding-back-button">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-[13px] font-semibold text-mute" data-testid="onboarding-step-label">
            {i + 1} of {STEPS.length}
          </span>
          <span className="w-11" />
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
          <motion.div className="h-full rounded-full bg-brand" animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
      </div>

      <div className="flex-1 px-5 pb-32 pt-7">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 * dir }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            data-testid={`onboarding-step-${step}`}
          >
            <p className="vo-eyebrow mb-2">{eyebrow}</p>
            <h1 className="vo-h1">{title}</h1>
            <p className="mb-7 mt-2 text-[15px] text-mute">{sub}</p>

            {step === "name" && (
              <input
                autoFocus
                className="vo-input font-display text-[22px] font-semibold"
                placeholder="Your first name"
                maxLength={30}
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && next()}
                data-testid="onboarding-name-input"
              />
            )}
            {step === "birthday" && <BirthdayInput value={form.bday} onChange={(bday) => set({ bday })} />}
            {step === "gender" && <OptionList options={meta.genders} value={form.gender} onChange={(gender) => set({ gender })} render={genderLabel} testIdPrefix="onboarding-gender" />}
            {step === "looking" && <OptionList options={meta.show_me} value={form.looking_for} onChange={(looking_for) => set({ looking_for })} render={showMeLabel} testIdPrefix="onboarding-looking" />}
            {step === "photos" && <PhotoGrid photos={form.photos} onChange={(photos) => set({ photos })} max={meta.max_photos} />}
            {step === "interests" && <InterestPicker all={meta.interests} value={form.interests} onChange={(interests) => set({ interests })} />}
            {step === "prompts" && <PromptEditor questions={meta.prompts} value={form.prompts} onChange={(prompts) => set({ prompts })} />}
            {step === "about" && (
              <div className="space-y-8">
                <div>
                  <div className="vo-label mb-2">Bio</div>
                  <textarea
                    className="vo-textarea min-h-[110px]"
                    placeholder="Two sentences that sound like you..."
                    maxLength={300}
                    value={form.bio}
                    onChange={(e) => set({ bio: e.target.value })}
                    data-testid="onboarding-bio-input"
                  />
                  <div className="mt-1 text-right text-[12px] text-mute">{form.bio.length}/300</div>
                </div>
                <div>
                  <div className="vo-label mb-2">Location</div>
                  <LocationPicker cities={meta.cities} value={form.location} onChange={(location) => set({ location })} />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-line bg-[rgba(251,251,252,0.95)] px-5 pb-6 pt-3 backdrop-blur-md" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
        <button type="button" className="vo-btn-primary w-full" disabled={!valid || saving} onClick={next} data-testid="onboarding-next-button">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : step === "about" ? "Finish and start swiping" : <>Continue <ArrowRight className="h-5 w-5" /></>}
        </button>
      </div>
    </div>
  );
}
