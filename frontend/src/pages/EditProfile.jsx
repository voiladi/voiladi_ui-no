import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Check, X } from "lucide-react";
import { Spinner } from "@/components/Loading";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/hooks/useMeta";
import { useFlash } from "@/hooks/useFlash";
import { PhotoGrid } from "@/components/PhotoGrid";
import { ModalHeader } from "@/components/EmptyState";
import { Chip, Segmented } from "@/components/Chip";
import { PromptEditor, LocationPicker } from "@/components/ProfileFields";
import { genderLabel, longDate } from "@/lib/format";

const ageOf = (iso) => {
  if (!iso) return null;
  const b = new Date(`${iso}T12:00:00`);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const md = t.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && t.getDate() < b.getDate())) a -= 1;
  return a;
};

/* Grouped list row; tapping opens an inline editor underneath. */
const Row = ({ label, value, open, onToggle, children, testId }) => (
  <div className={open ? "bg-bg" : ""}>
    <button type="button" onClick={onToggle} className="vo-row justify-between" aria-expanded={open} data-testid={testId}>
      <span>{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-normal text-mute">
        <span className="max-w-[180px] truncate">{value}</span>
        <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
      </span>
    </button>
    {open && <div className="px-4 pb-4 pt-1">{children}</div>}
  </div>
);

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { meta } = useMeta();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(null);
  const [limitHit, flashLimit] = useFlash();
  const [form, setForm] = useState({
    name: user?.name || "",
    username: user?.username || "",
    birthday: user?.birthday || "",
    gender: user?.gender || "",
    bio: user?.bio || "",
    job: user?.job || "",
    relationship_goal: user?.relationship_goal || "",
    interests: user?.interests || [],
    prompts: user?.prompts || [],
    location: { city: user?.city || "", lat: user?.lat ?? null, lng: user?.lng ?? null },
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const age = ageOf(form.birthday);

  /* live username check (debounced) */
  const cleanUsername = form.username.trim().replace(/^@/, "").toLowerCase();
  const [uCheck, setUCheck] = useState({ state: "idle", reason: "" });
  useEffect(() => {
    if (!cleanUsername || cleanUsername === (user?.username || "")) {
      setUCheck({ state: "idle", reason: "" });
      return undefined;
    }
    setUCheck({ state: "checking", reason: "" });
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/profile/username-available", { params: { u: cleanUsername } });
        setUCheck({ state: data.available ? "ok" : "bad", reason: data.reason });
      } catch (e) {
        setUCheck({ state: "bad", reason: errMsg(e) });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [cleanUsername, user?.username]);

  const usernameOk = cleanUsername.length > 0 && uCheck.state !== "bad" && uCheck.state !== "checking";
  const valid = form.name.trim().length >= 1 && usernameOk && form.birthday && age >= 18 && age <= 100 && form.gender && form.prompts.every((p) => p.answer.trim());

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const { data } = await api.put("/profile", {
        name: form.name.trim(),
        username: cleanUsername,
        birthday: form.birthday,
        gender: form.gender,
        bio: form.bio.trim(),
        job: form.job.trim(),
        relationship_goal: form.relationship_goal,
        interests: form.interests,
        prompts: form.prompts.filter((p) => p.answer.trim()),
        city: form.location.city || "",
        lat: form.location.lat,
        lng: form.location.lng,
        clear_location: !form.location.city,
      });
      setUser(data);
      navigate("/profile");
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col" data-testid="edit-profile-page">
      <ModalHeader
        left={
          <button type="button" className="text-[16px] text-ink" onClick={() => navigate("/profile")} data-testid="edit-back-button">
            Cancel
          </button>
        }
        title="Edit Profile"
        right={
          <button type="button" className="text-[16px] font-semibold text-ink disabled:opacity-40" disabled={!valid || saving} aria-busy={saving} onClick={save} data-testid="edit-save-button">
            {saving ? <Spinner size={20} stroke={2} /> : "Done"}
          </button>
        }
      />

      <div className="flex-1 px-4 pb-10 pt-2">
        <PhotoGrid photos={user?.photos || []} onChange={(photos) => setUser((u) => ({ ...u, photos }))} max={meta.max_photos} />

        <h3 className="vo-section mt-7 mb-2.5">About me</h3>
        <div className="vo-card overflow-hidden">
          <Row label={form.bio ? "" : "Add a short bio"} value={form.bio || ""} open={open === "bio"} onToggle={() => toggle("bio")} testId="edit-bio-row">
            <textarea className="vo-textarea min-h-[100px] bg-bg" maxLength={300} placeholder="Good conversations, great people, better days." value={form.bio} onChange={(e) => set({ bio: e.target.value })} data-testid="edit-bio-input" />
            <div className="mt-1 text-right text-[12px] text-mute">{form.bio.length}/300</div>
          </Row>
        </div>

        <h3 className="vo-section mt-7 mb-2.5">Basics</h3>
        <div className="vo-card overflow-hidden">
          <Row label="Name" value={form.name} open={open === "name"} onToggle={() => toggle("name")} testId="edit-name-row">
            <input className="vo-input bg-bg" maxLength={30} value={form.name} onChange={(e) => set({ name: e.target.value })} data-testid="edit-name-input" />
          </Row>
          <Row label="Username" value={cleanUsername ? `@${cleanUsername}` : "Add"} open={open === "username"} onToggle={() => toggle("username")} testId="edit-username-row">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-mute">@</span>
              <input
                className="vo-input bg-bg pl-9 pr-10 lowercase"
                maxLength={20}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="yourname"
                value={form.username}
                onChange={(e) => set({ username: e.target.value.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "").toLowerCase() })}
                aria-invalid={uCheck.state === "bad" || undefined}
                data-testid="edit-username-input"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2" data-testid="edit-username-status">
                {uCheck.state === "checking" && <Spinner size={16} stroke={2} />}
                {uCheck.state === "ok" && <Check className="h-[18px] w-[18px] text-ink" strokeWidth={2.5} />}
                {uCheck.state === "bad" && <X className="h-[18px] w-[18px] text-red" strokeWidth={2.5} />}
              </span>
            </div>
            <p className={`mt-1.5 text-[12px] ${uCheck.state === "bad" ? "text-red" : "text-mute"}`} data-testid="edit-username-hint">
              {uCheck.state === "bad" ? uCheck.reason : uCheck.state === "ok" ? "Available" : "3-20 characters: letters, numbers, dots and underscores. People can find you by it."}
            </p>
          </Row>
          <Row label="Age" value={age ?? ""} open={open === "age"} onToggle={() => toggle("age")} testId="edit-age-row">
            <input type="date" className="vo-input bg-bg" value={form.birthday} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ birthday: e.target.value })} data-testid="edit-dob-input" />
            <p className="mt-1.5 text-[12px] text-mute">{form.birthday ? `Born ${longDate(form.birthday)}. ` : ""}Only your age is shown.</p>
          </Row>
          <Row label="Gender" value={genderLabel(form.gender)} open={open === "gender"} onToggle={() => toggle("gender")} testId="edit-gender-row">
            <Segmented options={meta.genders} value={form.gender} onChange={(gender) => set({ gender })} render={genderLabel} testIdPrefix="gender" className="bg-surface2" />
          </Row>
          <Row label="Location" value={form.location.city || "Add"} open={open === "location"} onToggle={() => toggle("location")} testId="edit-location-row">
            <LocationPicker cities={meta.cities} value={form.location} onChange={(location) => set({ location })} />
          </Row>
          <Row label="Work / Study" value={form.job || "Add"} open={open === "job"} onToggle={() => toggle("job")} testId="edit-job-row">
            <input className="vo-input bg-bg" maxLength={40} placeholder="Student, Designer, Barista..." value={form.job} onChange={(e) => set({ job: e.target.value })} data-testid="edit-job-input" />
          </Row>
          <Row label="Looking for" value={form.relationship_goal || "Add"} open={open === "goal"} onToggle={() => toggle("goal")} testId="edit-goal-row">
            <div className="flex flex-wrap gap-2">
              {meta.goals.map((g) => (
                <Chip key={g} active={form.relationship_goal === g} className="bg-bg" onClick={() => set({ relationship_goal: form.relationship_goal === g ? "" : g })} data-testid={`goal-chip-${g.replace(/\s+/g, "-").toLowerCase()}`}>
                  {g}
                </Chip>
              ))}
            </div>
          </Row>
        </div>

        <h3 className="vo-section mt-7 mb-2.5">More about you</h3>
        <div className="vo-card overflow-hidden">
          <Row label="Interests" value={form.interests.length ? `${form.interests.length} selected` : "Add"} open={open === "interests"} onToggle={() => toggle("interests")} testId="edit-interests-row">
            <div className="flex flex-wrap gap-2" data-testid="interests-list">
              {meta.interests.map((i) => (
                <Chip
                  key={i}
                  active={form.interests.includes(i)}
                  className="bg-bg"
                  onClick={() => {
                    if (form.interests.includes(i)) set({ interests: form.interests.filter((x) => x !== i) });
                    else if (form.interests.length >= 10) flashLimit();
                    else set({ interests: [...form.interests, i] });
                  }}
                  data-testid={`interest-chip-${i.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {i}
                </Chip>
              ))}
            </div>
            <p className={`mt-2 text-[12px] ${limitHit ? "font-semibold text-red" : "text-mute"}`} style={{ transition: "color 150ms" }} data-testid="interests-count">
              {limitHit ? "10/10 - that's the maximum" : `${form.interests.length}/10 - pick at least 3 to be shown to others.`}
            </p>
          </Row>
          <Row label="Vibe check" value={form.prompts.length ? `${form.prompts.length} ${form.prompts.length === 1 ? "prompt" : "prompts"}` : "Add"} open={open === "prompts"} onToggle={() => toggle("prompts")} testId="edit-prompts-row">
            <PromptEditor questions={meta.prompts} value={form.prompts} onChange={(prompts) => set({ prompts })} />
          </Row>
        </div>

        <button type="button" className="vo-btn-primary mt-8 w-full" disabled={!valid || saving} aria-busy={saving} onClick={save} data-testid="edit-save-bottom-button">
          {saving ? <Spinner size={20} stroke={2} /> : "Done"}
        </button>
      </div>
    </div>
  );
}
