import React from "react";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UserPhoto } from "@/components/UserPhoto";
import { tween } from "@/lib/motion";

/* Calm iOS-style match sheet: two photos, one line of copy, two actions. No confetti, no springs. */
export const MatchModal = ({ match, me, onClose, onSayHi }) => {
  const open = !!match;
  const other = match?.user;
  const why = () => {
    if (match?.their_reaction) return `${other.name} liked your ${match.their_reaction.type === "photo" ? "photo" : "answer"}. It's already in your chat.`;
    if (match?.reaction) return `You liked their ${match.reaction.type === "photo" ? "photo" : "answer"}. It's already in your chat.`;
    if (match?.superlike) return "Someone sent a Voila. This one's a little special.";
    return "Say something. Don't leave them on read.";
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="w-[calc(100%-40px)] max-w-[340px] overflow-hidden rounded-sheet border-0 bg-white p-0 shadow-float [&>button]:hidden"
        data-testid="match-modal"
      >
        {other && (
          <div className="px-6 pb-6 pt-8 text-center">
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={tween(0.3, 0.05)} className="mx-auto flex items-center justify-center">
              <UserPhoto src={me?.photos?.[0]} name={me?.name} className="h-[116px] w-[116px] rounded-card border-[3px] border-white text-3xl shadow-card" />
              <UserPhoto src={other.photos?.[0]} name={other.name} className="-ml-5 h-[116px] w-[116px] rounded-card border-[3px] border-white text-3xl shadow-card" />
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tween(0.25, 0.15)}>
              <DialogTitle className="mt-6 font-display text-[26px] font-bold leading-tight tracking-tight text-ink">It's a Voila</DialogTitle>
              <DialogDescription className="mt-2 text-[15px] leading-relaxed text-mute">
                You and <span className="font-semibold text-ink">{other.name}</span> liked each other. {why()}
              </DialogDescription>
            </motion.div>
            <div className="mt-7 space-y-2">
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
