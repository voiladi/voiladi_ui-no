export const timeAgo = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 45) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/* "2m ago" / "1d ago" as written in the Likes list. */
export const agoLabel = (iso) => {
  const t = timeAgo(iso);
  if (!t) return "";
  if (t === "now") return "just now";
  return /^\d+[mhd]$/.test(t) ? `${t} ago` : t;
};

export const clockTime = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

/* Chat list timestamp: time today, "Yesterday", weekday within a week, else date. */
export const chatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return clockTime(iso);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  if (today - d < 6 * 86400 * 1000) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

export const distanceLabel = (km, city) => {
  if (km === null || km === undefined) return city || "Location hidden";
  if (km < 1) return "Less than 1 km away";
  return `${km.toLocaleString()} km away`;
};

export const kmLabel = (km, city) => {
  if (km === null || km === undefined) return city || "";
  if (km < 1) return "<1 km";
  return `${km.toLocaleString()} km`;
};

export const activeLabel = (iso) => {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 600) return "Active now";
  if (s < 86400) return "Active today";
  if (s < 86400 * 7) return "Active this week";
  return "";
};

export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

export const genderLabel = (g) => ({ woman: "Woman", man: "Man", nonbinary: "Non-binary" }[g] || "");
export const showMeLabel = (s) => ({ women: "Women", men: "Men", everyone: "Everyone" }[s] || "");

export const longDate = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
};
