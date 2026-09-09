import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Sliders, ArrowRight, MapPin } from "lucide-react";
import { Logo } from "@/components/Logo";

const FEATURES = [
  { icon: Heart, title: "Swipe with taste", text: "Cards that show what you actually share, not just a face." },
  { icon: MessageCircle, title: "Vibe-check first", text: "Prompts and icebreakers so the first message isn't 'hey'." },
  { icon: Sliders, title: "Your rules", text: "Age, distance and who you want to see. Change it anytime." },
];

const MiniCard = ({ className, color, stamp, stampTone, delay, rotate = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24, rotate }}
    animate={{ opacity: 1, y: 0, rotate }}
    transition={{ delay, type: "spring", stiffness: 260, damping: 24 }}
    className={`absolute h-[190px] w-[136px] overflow-hidden rounded-[22px] border border-line bg-white shadow-[var(--vo-shadow)] ${className}`}
  >
    <div className="h-[120px] w-full" style={{ background: color }} />
    <div className="space-y-2 p-3">
      <div className="h-3 w-16 rounded-full bg-[rgba(11,18,32,0.8)]" />
      <div className="flex gap-1">
        <div className="h-2.5 w-10 rounded-full bg-brand-soft" />
        <div className="h-2.5 w-8 rounded-full bg-peach-soft" />
      </div>
    </div>
    {stamp && (
      <motion.span
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: -12 }}
        transition={{ delay: delay + 0.35, type: "spring", stiffness: 500, damping: 22 }}
        className={`absolute left-3 top-3 rounded-[10px] border-[2.5px] px-2 py-0.5 font-display text-[13px] font-bold uppercase tracking-wider ${stampTone}`}
      >
        {stamp}
      </motion.span>
    )}
  </motion.div>
);

export default function Welcome() {
  const navigate = useNavigate();
  return (
    <div className="relative flex min-h-full flex-col px-6 pb-8 pt-7" data-testid="welcome-page">
      <div className="vo-noise" />
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Logo size={38} textClass="text-[24px]" />
      </motion.div>

      <div className="relative mx-auto mt-6 h-[222px] w-full max-w-[320px]">
        <div className="absolute inset-x-6 top-4 h-[200px] rounded-[32px] bg-[linear-gradient(135deg,rgba(14,165,164,0.14),rgba(255,179,138,0.16))]" />
        <MiniCard className="left-3 top-7" rotate={-9} color="linear-gradient(160deg,#FFE2A3,#FFB020)" delay={0.1} />
        <MiniCard className="right-3 top-7" rotate={9} color="linear-gradient(160deg,#BFDDFF,#0A84FF)" delay={0.2} />
        <MiniCard className="left-[calc(50%-68px)] top-0" color="linear-gradient(160deg,#FFB3CC,#FF2D75)" stamp="Like" stampTone="border-brand bg-brand-soft text-brand" delay={0.3} />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 300, damping: 20 }}
          className="absolute -right-1 bottom-2 flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[var(--vo-shadow-soft)]"
        >
          <MapPin className="h-3.5 w-3.5 text-brand" /> 2 km away
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }} className="mt-8">
        <h1 className="vo-h1 text-[36px] leading-[1.05]">
          Meet people who <span className="text-brand">match your vibe.</span>
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-mute">Dating for 18 to 30-somethings who are done with the same old apps. Real profiles, real prompts, zero games.</p>
      </motion.div>

      <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-7 space-y-3.5">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand-dark">
              <f.icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
              <div className="text-[15px] font-semibold text-ink">{f.title}</div>
              <div className="text-[14px] leading-snug text-mute">{f.text}</div>
            </div>
          </li>
        ))}
      </motion.ul>

      <div className="mt-auto pt-8">
        <button type="button" className="vo-btn-primary w-full text-[16px]" onClick={() => navigate("/auth")} data-testid="welcome-get-started-button">
          Get started <ArrowRight className="h-5 w-5" />
        </button>
        <p className="mt-3 text-center text-[12px] leading-relaxed text-mute">You must be 18+ to join. Be kind, be real, be you.</p>
      </div>
    </div>
  );
}
