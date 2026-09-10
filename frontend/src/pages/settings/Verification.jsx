import React from "react";
import { useNavigate } from "react-router-dom";
import { Check, Camera, UserRoundCheck, MessageCircle, ChevronRight, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SoftPageHeader, SoftCard, SoftSectionLabel } from "@/components/SoftUI";
import { longDate } from "@/lib/format";

/*
 * Settings > Verification (like Instagram's Meta Verified page): what the black tick is, the current status,
 * how it works, and the one action - Get verified - which opens the selfie step.
 */

const Step = ({ icon: Icon, title, sub, last = false }) => (
  <div className={`flex items-center gap-3 px-3.5 py-3 ${last ? "" : "border-b border-line/80"}`}>
    <span className="vo-soft-tile h-[40px] w-[40px] rounded-[12px]">
      <Icon className="h-5 w-5" strokeWidth={1.8} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[16px] font-semibold leading-[20px] tracking-[-0.01em] text-ink">{title}</span>
      <span className="block text-[13.5px] leading-[17px] text-mute">{sub}</span>
    </span>
  </div>
);

export default function VerificationSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const v = user?.verification || {};
  const status = user?.verified ? "approved" : v.status || "none";

  const statusText = { approved: "Verified", pending: "In review", rejected: "Not approved", none: "Not verified" }[status];

  return (
    <div className="vo-neu-page flex min-h-full flex-col px-4 pb-10" data-testid="verification-settings-page">
      <SoftPageHeader title="Verification" onBack={() => navigate("/settings")} backTestId="verification-back-button" />

      {/* status */}
      <SoftCard className="mt-3 flex flex-col items-center px-5 pb-6 pt-7 text-center" testId="verification-status-card" data-status={status}>
        <span className={`inline-flex h-[64px] w-[64px] items-center justify-center rounded-full ${status === "approved" ? "bg-ink text-onink" : "vo-soft-sunken text-mute"}`} aria-hidden="true">
          {status === "pending" ? <Clock className="h-8 w-8" strokeWidth={1.8} /> : <Check className="h-9 w-9" strokeWidth={3} />}
        </span>
        <h2 className="mt-4 text-[clamp(21px,6cqi,24px)] font-bold leading-[1.15] tracking-[-0.02em] text-ink">Verified Profile</h2>
        <span className={`mt-2.5 inline-flex h-[30px] items-center rounded-full px-3.5 text-[13.5px] font-semibold tracking-[-0.01em] ${status === "approved" ? "bg-ink text-onink" : status === "rejected" ? "vo-soft text-red" : "vo-soft text-mute"}`} data-testid="verification-status-pill">
          {statusText}
        </span>
        <p className="mt-3.5 max-w-[300px] text-[15px] leading-[21px] text-mute" data-testid="verification-status-text">
          {status === "approved"
            ? "The black tick shows next to your name, and messaging is unlocked."
            : status === "pending"
              ? `We're checking your selfie${v.submitted_at ? ` (sent ${longDate(v.submitted_at)})` : ""}. This usually takes under a day - we'll notify you.`
              : status === "rejected"
                ? v.note || "We couldn't confirm your last selfie. Make sure your face is clearly visible and well lit, then try again."
                : "The black tick tells people you're a real person. It's checked by the Voiladi team and unlocks messaging with your matches."}
        </p>
      </SoftCard>

      {/* how it works */}
      <section className="mt-5">
        <SoftSectionLabel>How it works</SoftSectionLabel>
        <SoftCard className="overflow-hidden" testId="verification-steps-card">
          <Step icon={Camera} title="Take a live selfie" sub="Takes a few seconds. It's never shown on your profile." />
          <Step icon={UserRoundCheck} title="A person checks it" sub="Someone at Voiladi confirms it matches your photos." />
          <Step icon={MessageCircle} title="Get the black tick" sub="It appears next to your name and unlocks messaging." last />
        </SoftCard>
      </section>

      {/* action */}
      <div className="mt-6">
        {status === "approved" ? (
          <p className="text-center text-[14px] text-mute" data-testid="verification-done-note">You're all set.</p>
        ) : status === "pending" ? (
          <button type="button" disabled className="inline-flex h-[52px] w-full items-center justify-center rounded-full bg-ink/60 text-[17px] font-semibold text-onink" data-testid="verification-pending-button">
            In review
          </button>
        ) : (
          <button type="button" onClick={() => navigate("/verify")} className="inline-flex h-[52px] w-full items-center justify-center gap-1.5 rounded-full bg-ink text-[17px] font-semibold text-onink active:scale-[0.98]" style={{ transitionProperty: "transform", transitionDuration: "120ms" }} data-testid="verification-get-verified-button">
            {status === "rejected" ? "Try again" : "Get verified"}
            <ChevronRight className="h-5 w-5" strokeWidth={2.4} />
          </button>
        )}
        {status !== "approved" && <p className="mt-3 px-4 text-center text-[13px] leading-[17px] text-mute">Your selfie is only used to confirm it's you. It's never posted or shared.</p>}
      </div>
    </div>
  );
}
