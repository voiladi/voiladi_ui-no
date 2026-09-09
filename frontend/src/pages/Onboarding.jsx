import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar, Camera, Bell, Lock } from "lucide-react";
import { Spinner } from "@/components/Loading";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { UserPhoto } from "@/components/UserPhoto";
import { LogoMark } from "@/components/Logo";
import { Chip, Segmented } from "@/components/Chip";
import { PhoneField, OtpBoxes, DevCodeCard, guessCountry, mmss } from "@/components/PhoneOtp";
import { genderLabel } from "@/lib/format";
import { slideX } from "@/lib/motion";

const ageOf = (iso) => {
  if (!iso) return null;
  const b = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const md = t.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && t.getDate() < b.getDate())) a -= 1;
  return a;
};

const MIN_INTERESTS = 3;
const SKIP_KEY = "voiladi_skip_photo";
const ORDER = ["name", "phone", "otp", "photo", "interests", "notifications", "done"];

const firstStep = (user) => {
  if (!user?.has_basics) return "name";
  if (!user?.phone) return "phone";
  if (!(user?.photos || []).length && !sessionStorage.getItem(SKIP_KEY)) return "photo";
  if ((user?.interests || []).length < MIN_INTERESTS) return "interests";
  return "notifications";
};

const Step = ({ title, sub, children, testId }) => (
  <motion.div {...slideX(1)} className="flex flex-1 flex-col" data-testid={testId}>
    <h1 className="vo-h1">{title}</h1>
    {sub && <p className="vo-sub mt-1.5">{sub}</p>}
    {children}
  </motion.div>
);

export default function Onboarding() {
  const { user, setUser, refresh } = useAuth();
  const { meta } = useMeta();
  const [step, setStep] = useState(() => firstStep(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // name step
  const [name, setName] = useState(user?.name || "");
  const [dob, setDob] = useState(user?.birthday || "");
  const [gender, setGender] = useState(user?.gender || "");
  // phone + otp
  const [cc, setCc] = useState(guessCountry);
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef(null);
  const fileRef = useRef(null);
  // interests
  const [interests, setInterests] = useState(user?.interests || []);

  const fullPhone = useMemo(() => `${cc}${number.replace(/\D/g, "")}`, [cc, number]);
  const validPhone = number.replace(/\D/g, "").length >= 7;
  const age = ageOf(dob);
  const nameValid = name.trim().length >= 1 && name.trim().length <= 30 && age !== null && age >= 18 && age <= 100 && !!gender;

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const go = (s) => {
    setError("");
    setStep(s);
  };

  const back = () => {
    const i = ORDER.indexOf(step);
    if (i <= 0) return;
    let prev = ORDER[i - 1];
    if (prev === "otp") prev = "phone";
    if (prev === "phone" && user?.phone) prev = "name";
    go(prev);
  };

  const saveBasics = async () => {
    if (!nameValid || saving) return;
    setSaving(true);
    try {
      const { data } = await api.put("/profile", { name: name.trim(), birthday: dob, gender });
      setUser(data);
      go(data.phone ? (data.photos?.length ? "interests" : "photo") : "phone");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const requestOtp = async () => {
    if (!validPhone || saving) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/auth/request-otp", { phone: fullPhone });
      setDevCode(data.dev_code || null);
      setResendIn(data.resend_in || 30);
      setCode("");
      go("otp");
      setTimeout(() => otpRef.current?.focus(), 250);
    } catch (e) {
      setError(errMsg(e));
      if (e?.response?.status === 429) go("otp");
    } finally {
      setSaving(false);
    }
  };

  const verifyPhone = async (value) => {
    const c = value || code;
    if (c.length !== 6 || saving) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/auth/verify-phone", { phone: fullPhone, code: c });
      setUser(data);
      go(data.photos?.length ? "interests" : "photo");
    } catch (e) {
      setError(errMsg(e));
      setCode("");
      setTimeout(() => otpRef.current?.focus(), 50);
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only images are allowed");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Images must be under 8MB");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/profile/photos", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setUser((u) => ({ ...u, photos: data.photos }));
    } catch (err) {
      toast.error(errMsg(err, "Upload failed. Try another photo."));
    } finally {
      setSaving(false);
    }
  };

  const saveInterests = async () => {
    if (interests.length < MIN_INTERESTS || saving) return;
    setSaving(true);
    try {
      const { data } = await api.put("/profile", { interests });
      setUser(data);
      go("notifications");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const enableNotifications = async () => {
    try {
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    } catch (e) {
      // ignore
    }
    go("done");
  };

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { data } = await api.put("/profile", { onboarded: true });
      sessionStorage.removeItem(SKIP_KEY);
      setUser(data);
      if (!data.onboarded) await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const photo = user?.photos?.[0];
  const showBack = step !== "done" && step !== "name";

  return (
    <div className="flex min-h-full flex-col px-5 pb-6 pt-3" data-testid="onboarding-wizard">
      <div className="h-10">
        {showBack && (
          <button type="button" onClick={back} className="vo-icon-plain -ml-2" aria-label="Back" data-testid="onboarding-back-button">
            <ArrowLeft className="h-6 w-6" strokeWidth={2} />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === "name" && (
          <Step key="name" testId="onboarding-step-name" title="What's your name?" sub="This is how you'll appear on Voiladi.">
            <form
              className="mt-8 flex flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                saveBasics();
              }}
            >
              <label className="vo-label mb-2" htmlFor="ob-name">
                Full name
              </label>
              <input id="ob-name" autoFocus className="vo-input" placeholder="Your name" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} data-testid="onboarding-name-input" />

              <label className="vo-label mb-2 mt-5" htmlFor="ob-dob">
                Date of birth
              </label>
              <div className="relative">
                <input
                  id="ob-dob"
                  type="date"
                  className="vo-input appearance-none pr-12"
                  value={dob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDob(e.target.value)}
                  data-testid="onboarding-dob-input"
                />
                <Calendar className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink" strokeWidth={1.75} />
              </div>
              <p className={`mt-3 text-center text-[14px] ${dob && age !== null && age < 18 ? "text-red" : "text-mute"}`} data-testid="onboarding-age-note">
                You must be 18 or older to use Voiladi.
              </p>

              <span className="vo-label mb-2 mt-5">I am</span>
              <Segmented options={meta.genders} value={gender} onChange={setGender} render={genderLabel} testIdPrefix="onboarding-gender" />

              {error && (
                <p className="mt-3 text-[14px] text-red" data-testid="onboarding-error">
                  {error}
                </p>
              )}
              <div className="mt-auto pt-8">
                <button type="submit" className="vo-btn-primary w-full" disabled={!nameValid || saving} aria-busy={saving} data-testid="onboarding-next-button">
                  {saving ? <Spinner size={20} stroke={2} /> : "Continue"}
                </button>
              </div>
            </form>
          </Step>
        )}

        {step === "phone" && (
          <Step key="phone" testId="onboarding-step-phone" title="Add your phone number" sub="We'll send you a verification code.">
            <form
              className="mt-8 flex flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                requestOtp();
              }}
            >
              <PhoneField cc={cc} onCc={setCc} number={number} onNumber={setNumber} error={!!error} />
              {error && (
                <p className="mt-3 text-[14px] text-red" data-testid="onboarding-error">
                  {error}
                </p>
              )}
              <div className="mt-auto pt-8">
                <button type="submit" className="vo-btn-primary w-full" disabled={!validPhone || saving} aria-busy={saving} data-testid="onboarding-next-button">
                  {saving ? <Spinner size={20} stroke={2} /> : "Continue"}
                </button>
                <p className="mt-5 flex items-center justify-center gap-1.5 text-[14px] text-mute">
                  <Lock className="h-4 w-4" /> Your number is kept private.
                </p>
              </div>
            </form>
          </Step>
        )}

        {step === "otp" && (
          <Step
            key="otp"
            testId="onboarding-step-otp"
            title="Enter the code"
            sub={
              <>
                We've sent a 6-digit code to
                <br />
                <span className="text-ink">{fullPhone}</span>
              </>
            }
          >
            <div className="mt-10">
              <OtpBoxes
                ref={otpRef}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setError("");
                }}
                onComplete={(v) => verifyPhone(v)}
                disabled={saving} aria-busy={saving}
              />
            </div>
            {error && (
              <p className="mt-4 text-center text-[14px] text-red" data-testid="onboarding-error">
                {error}
              </p>
            )}
            <p className="mt-10 text-center text-[14px] text-mute">
              Didn't receive the code?{" "}
              {resendIn > 0 ? (
                <span data-testid="auth-resend-timer">Resend in {mmss(resendIn)}</span>
              ) : (
                <button type="button" className="vo-link text-[14px]" onClick={requestOtp} disabled={saving} aria-busy={saving} data-testid="auth-resend-button">
                  Resend
                </button>
              )}
            </p>
            {devCode && (
              <DevCodeCard
                code={devCode}
                onUse={() => {
                  setCode(devCode);
                  verifyPhone(devCode);
                }}
              />
            )}
            <div className="mt-auto pt-8">
              <button type="button" className="vo-btn-primary w-full" disabled={code.length !== 6 || saving} aria-busy={saving} onClick={() => verifyPhone()} data-testid="onboarding-next-button">
                {saving ? <Spinner size={20} stroke={2} /> : "Continue"}
              </button>
            </div>
          </Step>
        )}

        {step === "photo" && (
          <Step key="photo" testId="onboarding-step-photo" title="Add a profile photo" sub="A clear photo helps you get better matches.">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="photo-file-input" />
            <div className="mt-14 flex justify-center">
              <button type="button" onClick={() => fileRef.current?.click()} className="relative block h-[220px] w-[220px] rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue" aria-label="Add photo" data-testid="onboarding-photo-add-button" disabled={saving} aria-busy={saving}>
                {photo ? (
                  <UserPhoto src={photo} name={user?.name} className="h-full w-full rounded-full text-5xl" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-surface text-mute">
                    <Camera className="h-14 w-14" strokeWidth={1.4} />
                  </span>
                )}
                <span className="absolute bottom-2 right-0 flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink shadow-action">
                  {saving ? <Spinner size={24} stroke={2} /> : <Camera className="h-6 w-6" strokeWidth={2} />}
                </span>
              </button>
            </div>
            <div className="mt-auto pt-8">
              <button type="button" className="vo-btn-primary w-full" disabled={!photo || saving} aria-busy={saving} onClick={() => go("interests")} data-testid="onboarding-next-button">
                Continue
              </button>
              <button
                type="button"
                className="vo-btn-secondary mt-2.5 w-full"
                onClick={() => {
                  sessionStorage.setItem(SKIP_KEY, "1");
                  go("interests");
                }}
                data-testid="onboarding-skip-photo-button"
              >
                Skip for now
              </button>
            </div>
          </Step>
        )}

        {step === "interests" && (
          <Step key="interests" testId="onboarding-step-interests" title="What are you into?" sub="Select a few interests to find people with similar vibes.">
            <div className="mt-8 grid grid-cols-3 gap-3" data-testid="interests-list">
              {meta.interests.map((i) => (
                <Chip
                  key={i}
                  active={interests.includes(i)}
                  className="h-11 w-full whitespace-nowrap px-2 text-[14px]"
                  onClick={() => {
                    if (interests.includes(i)) setInterests(interests.filter((x) => x !== i));
                    else if (interests.length >= 10) toast("You can pick up to 10");
                    else setInterests([...interests, i]);
                  }}
                  data-testid={`interest-chip-${i.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {i}
                </Chip>
              ))}
            </div>
            <p className="mt-4 text-center text-[14px] text-mute" data-testid="interests-count">
              {interests.length < MIN_INTERESTS ? `Pick at least ${MIN_INTERESTS}` : `${interests.length} selected`}
            </p>
            {error && (
              <p className="mt-3 text-[14px] text-red" data-testid="onboarding-error">
                {error}
              </p>
            )}
            <div className="vo-bar sticky bottom-0 -mx-5 mt-auto px-5 pt-4" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
              <button type="button" className="vo-btn-primary w-full" disabled={interests.length < MIN_INTERESTS || saving} aria-busy={saving} onClick={saveInterests} data-testid="onboarding-next-button">
                {saving ? <Spinner size={20} stroke={2} /> : "Continue"}
              </button>
            </div>
          </Step>
        )}

        {step === "notifications" && (
          <Step key="notifications" testId="onboarding-step-notifications" title="Turn on notifications?" sub="Get notified about new matches, messages and more.">
            <div className="mt-16 flex justify-center">
              <span className="flex h-[160px] w-[160px] items-center justify-center rounded-full bg-surface text-ink">
                <Bell className="h-16 w-16" strokeWidth={1.4} />
              </span>
            </div>
            <div className="mt-auto pt-8">
              <button type="button" className="vo-btn-primary w-full" onClick={enableNotifications} data-testid="onboarding-enable-notifications-button">
                Enable Notifications
              </button>
              <button type="button" className="vo-btn-secondary mt-2.5 w-full" onClick={() => go("done")} data-testid="onboarding-skip-notifications-button">
                Not now
              </button>
            </div>
          </Step>
        )}

        {step === "done" && (
          <motion.div key="done" {...slideX(1)} className="relative flex flex-1 flex-col items-center text-center" data-testid="onboarding-step-done">
            <Confetti />
            <LogoMark size={88} className="mt-[16vh]" />
            <h1 className="vo-h1 mt-6">You're all set!</h1>
            <p className="vo-sub mt-2">
              Welcome to Voiladi.
              <br />
              Let's make better connections.
            </p>
            <div className="mt-auto w-full pt-8">
              <button type="button" className="vo-btn-primary w-full" onClick={finish} disabled={saving} aria-busy={saving} data-testid="onboarding-finish-button">
                {saving ? <Spinner size={20} stroke={2} /> : "Continue"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Static scattered dots, as on the "You're all set" screen. */
const DOTS = [
  ["10%", "6%", "#F59E0B", 7, 0], ["50%", "3%", "#3478F6", 6, 45], ["86%", "9%", "#EF4444", 7, 30], ["22%", "17%", "#8B5CF6", 6, 0],
  ["70%", "18%", "#10B981", 6, 45], ["92%", "26%", "#F59E0B", 5, 0], ["6%", "30%", "#EC4899", 6, 45], ["36%", "34%", "#3478F6", 5, 0],
  ["84%", "40%", "#10B981", 7, 30], ["14%", "48%", "#EF4444", 6, 45], ["62%", "52%", "#8B5CF6", 6, 0], ["94%", "58%", "#EC4899", 5, 45],
  ["28%", "62%", "#F59E0B", 6, 0], ["48%", "66%", "#EF4444", 5, 45], ["78%", "70%", "#3478F6", 7, 30],
];

const Confetti = () => (
  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
    {DOTS.map(([x, y, c, s, r], i) => (
      <span key={i} className="absolute" style={{ left: x, top: y, width: s, height: s, background: c, borderRadius: r ? 1 : 9999, transform: `rotate(${r}deg)`, opacity: 0.9 }} />
    ))}
  </div>
);
