import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UserPhoto } from "@/components/UserPhoto";
import { LogoMark } from "@/components/Logo";

const COLORS = ["#FF2D75", "#FFB020", "#FFD60A", "#0A84FF", "#0A0A0F"];

const Confetti = () => {
  const bits = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        angle: (i / 18) * Math.PI * 2 + Math.random() * 0.4,
        dist: 110 + Math.random() * 80,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        round: Math.random() > 0.5,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className="absolute"
          style={{ width: b.size, height: b.size, background: b.color, borderRadius: b.round ? "50%" : 3 }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{ x: Math.cos(b.angle) * b.dist, y: Math.sin(b.angle) * b.dist - 40, opacity: [0, 1, 0], scale: [0.4, 1, 0.8], rotate: 220 }}
          transition={{ duration: 1.3, delay: 0.15 + (b.id % 6) * 0.04, ease: "easeOut" }}
        />
      ))}
    </div>
  );
};

export const MatchModal = ({ match, me, onClose, onSayHi }) => {
  const open = !!match;
  const other = match?.user;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="w-[calc(100%-32px)] max-w-[360px] overflow-hidden rounded-[30px] border-line bg-white p-0 shadow-[0_30px_90px_rgba(11,18,32,0.22)] [&>button]:hidden"
        data-testid="match-modal"
      >
        {other && (
          <div className="relative px-6 pb-6 pt-9 text-center">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_50%_30%,rgba(255,45,117,0.14),transparent_65%)]" />
            <Confetti />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 360, damping: 26, mass: 0.9 }}
              className="relative mx-auto flex h-36 items-center justify-center"
            >
              <motion.div initial={{ x: 20, rotate: -6 }} animate={{ x: -14, rotate: -8 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="relative z-10">
                <UserPhoto src={me?.photos?.[0]} name={me?.name} className="h-32 w-32 rounded-[30px] border-4 border-white text-4xl shadow-[var(--vo-shadow)]" />
              </motion.div>
              <motion.div initial={{ x: -20, rotate: 6 }} animate={{ x: 14, rotate: 8 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="relative z-20 -ml-10">
                <UserPhoto src={other.photos?.[0]} name={other.name} className="h-32 w-32 rounded-[30px] border-4 border-white text-4xl shadow-[var(--vo-shadow)]" />
              </motion.div>
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.25, type: "spring", stiffness: 400, damping: 18 }}
                className="absolute -bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-[14px] border-4 border-white shadow-lg"
              >
                <LogoMark size={40} />
              </motion.div>
            </motion.div>
            <DialogTitle className="vo-h1 mt-7 text-[34px]">It's a Voila!</DialogTitle>
            <DialogDescription className="mt-2 text-[15px] text-mute">
              You and <span className="font-semibold text-ink">{other.name}</span> liked each other.
              {match.reaction || match.their_reaction
                ? ` ${match.their_reaction ? `${other.name} liked your ${match.their_reaction.type === "photo" ? "photo" : "answer"}` : `You liked their ${match.reaction.type === "photo" ? "photo" : "answer"}`} - it's already waiting in your chat.`
                : match.superlike
                  ? " Someone sent a Voila, so this one's special."
                  : " Don't leave them on read."}
            </DialogDescription>
            <div className="mt-7 space-y-2.5">
              <button type="button" className="vo-btn-primary w-full" onClick={onSayHi} data-testid="match-say-hi-button">
                <MessageCircle className="h-5 w-5" /> Say hi to {other.name}
              </button>
              <button type="button" className="vo-btn-ghost w-full" onClick={onClose} data-testid="match-keep-swiping-button">
                Keep swiping
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
