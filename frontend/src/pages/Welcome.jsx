import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Sliders, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { tween } from "@/lib/motion";

const FEATURES = [
  { icon: Heart, title: "Swipe with taste", text: "Cards that show what you actually share, not just a face." },
  { icon: MessageCircle, title: "Vibe-check first", text: "Prompts and icebreakers so the first message isn't 'hey'." },
  { icon: Sliders, title: "Your rules", text: "Age, distance and who you want to see. Change it anytime." },
];

const INK = "#1D1D1F";
const TINT = "#2B4C7E";
const LINE = "#D1D1D6";
const FILL = "#F5F5F7";

/* Monochrome line-art: a profile card stack, a heart, a reply. No photos, no gradients. */
const Illustration = () => (
  <svg viewBox="0 0 320 232" className="h-auto w-full" role="img" aria-label="Two profile cards, a like and a reply" data-testid="welcome-illustration">
    {/* back card */}
    <g transform="rotate(-8 118 122)">
      <rect x="58" y="38" width="120" height="168" rx="16" fill={FILL} stroke={LINE} strokeWidth="1.5" />
      <rect x="70" y="50" width="96" height="104" rx="10" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
      <circle cx="118" cy="90" r="16" fill="none" stroke={LINE} strokeWidth="1.5" />
      <path d="M90 150 C94 126 142 126 146 150" fill="none" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="70" y="166" width="56" height="8" rx="4" fill={LINE} />
      <rect x="70" y="182" width="36" height="8" rx="4" fill={LINE} opacity="0.7" />
    </g>
    {/* front card */}
    <g transform="rotate(4 176 122)">
      <rect x="116" y="30" width="124" height="176" rx="16" fill="#FFFFFF" stroke={INK} strokeWidth="1.5" />
      <rect x="128" y="42" width="100" height="108" rx="10" fill={FILL} stroke={INK} strokeWidth="1.5" />
      <circle cx="178" cy="84" r="17" fill="#FFFFFF" stroke={INK} strokeWidth="1.5" />
      <path d="M148 146 C152 120 204 120 208 146" fill="#FFFFFF" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="128" y="162" width="62" height="9" rx="4.5" fill={INK} />
      <rect x="128" y="180" width="30" height="8" rx="4" fill={FILL} stroke={INK} strokeWidth="1.25" />
      <rect x="164" y="180" width="38" height="8" rx="4" fill={FILL} stroke={INK} strokeWidth="1.25" />
      {/* heart button */}
      <circle cx="218" cy="150" r="15" fill={INK} />
      <path d="M218 157.5 c-5.5 -4.2 -8.5 -7 -8.5 -10.4 a4.3 4.3 0 0 1 8.5 -1.3 a4.3 4.3 0 0 1 8.5 1.3 c0 3.4 -3 6.2 -8.5 10.4z" fill="#FFFFFF" />
    </g>
    {/* reply bubble */}
    <g>
      <path d="M236 36 h52 a10 10 0 0 1 10 10 v20 a10 10 0 0 1 -10 10 h-36 l-12 10 v-10 h-4 a10 10 0 0 1 -10 -10 v-20 a10 10 0 0 1 10 -10z" fill="#FFFFFF" stroke={TINT} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="252" cy="56" r="2.5" fill={TINT} />
      <circle cx="262" cy="56" r="2.5" fill={TINT} />
      <circle cx="272" cy="56" r="2.5" fill={TINT} />
    </g>
    {/* distance pill */}
    <g>
      <rect x="22" y="186" width="78" height="26" rx="13" fill="#FFFFFF" stroke={INK} strokeWidth="1.5" />
      <path d="M36 203 c-3.6 -4 -5.4 -6.9 -5.4 -9.2 a5.4 5.4 0 0 1 10.8 0 c0 2.3 -1.8 5.2 -5.4 9.2z" fill="none" stroke={INK} strokeWidth="1.5" />
      <circle cx="36" cy="193.8" r="1.6" fill={INK} />
      <rect x="48" y="195" width="40" height="8" rx="4" fill={INK} />
    </g>
    {/* dotted connector */}
    <path d="M228 176 C250 172 262 110 244 78" fill="none" stroke={LINE} strokeWidth="1.5" strokeDasharray="3 5" strokeLinecap="round" />
  </svg>
);

export default function Welcome() {
  const navigate = useNavigate();
  return (
    <div className="relative flex min-h-full flex-col px-6 pb-8 pt-6" data-testid="welcome-page">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tween(0.3)}>
        <Logo size={34} textClass="text-[22px]" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={tween(0.4, 0.05)} className="mx-auto mt-6 w-full max-w-[320px]">
        <Illustration />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween(0.35, 0.15)} className="mt-6">
        <h1 className="vo-h1 text-[34px] leading-[1.08]">
          Meet people who
          <br />
          match your vibe.
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-mute">Dating for 18 to 30-somethings who are done with the same old apps. Real profiles, real prompts, zero games.</p>
      </motion.div>

      <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tween(0.3, 0.25)} className="mt-7 space-y-3.5">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-surface2 text-ink">
              <f.icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <div className="text-[15px] font-semibold text-ink">{f.title}</div>
              <div className="text-[14px] leading-snug text-mute">{f.text}</div>
            </div>
          </li>
        ))}
      </motion.ul>

      <div className="mt-auto pt-8">
        <button type="button" className="vo-btn-primary w-full" onClick={() => navigate("/auth")} data-testid="welcome-get-started-button">
          Get started <ArrowRight className="h-5 w-5" />
        </button>
        <p className="mt-3 text-center text-[12px] leading-relaxed text-mute">You must be 18+ to join. Be kind, be real, be you.</p>
      </div>
    </div>
  );
}
