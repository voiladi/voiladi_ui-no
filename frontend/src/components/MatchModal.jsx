import React from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UserPhoto } from "@/components/UserPhoto";
import { tween, D } from "@/lib/motion";

/* Match sheet: two round photos, "It's a match!", one primary button and a text button. */
export const MatchModal = ({ match, me, onClose, onSayHi }) => {
  const open = !!match;
  const other = match?.user;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-40px)] max-w-[340px] rounded-[24px] border-0 bg-bg p-6 shadow-modal [&>button]:hidden" data-testid="match-modal">
        {other && (
          <div className="flex flex-col items-center text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={tween(D.slow)} className="relative flex items-center justify-center">
              <UserPhoto src={me?.photos?.[0]} name={me?.name} size="sm" className="h-24 w-24 rounded-full border-4 border-bg text-2xl" />
              <UserPhoto src={other.photos?.[0]} name={other.name} size="sm" className="-ml-5 h-24 w-24 rounded-full border-4 border-bg text-2xl" />
              <span className="absolute -bottom-2 flex h-9 w-9 items-center justify-center rounded-full bg-ink text-onink shadow-action">
                <Heart className="h-4 w-4" fill="currentColor" />
              </span>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween(D.base, 0.08)} className="mt-6">
              <DialogTitle className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">It's a match!</DialogTitle>
              <DialogDescription className="mt-2 text-[15px] leading-relaxed text-mute">
                You and {other.name} liked each other.
              </DialogDescription>
            </motion.div>
            <div className="mt-6 w-full space-y-2">
              <button type="button" className="vo-btn-primary w-full" onClick={onSayHi} data-testid="match-say-hi-button">
                Send a message
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
