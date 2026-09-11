import React from "react";
import { useNavigate } from "react-router-dom";
import { Check, Camera, User, Clock, ChevronRight, X, Sun, Glasses, ScanFace } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SoftCard } from "@/components/SoftUI";
import { FlowPage, FlowTitle, FlowSub, StatusCircle, TipsCard, FlowButton } from "@/components/verification/VerifyUI";

/*
 * Settings > Verification. One route, four states (owner's reference screens):
 *   none      -> "Verified profile" intro with WHAT TO EXPECT + Get verified
 *   pending   -> "Under review"
 *   rejected  -> "Try again" with tips
 *   approved  -> "You're verified!"
 */

const Expect = ({ icon: Icon, title, sub, last = false }) => (
  <div className={`flex items-center gap-4 px-3.5 py-3.5 ${last ? "" : "border-b border-line/80"}`}>
    <span className="vo-soft-tile h-[52px] w-[52px] rounded-[16px]">
      <Icon className="h-[26px] w-[26px]" strokeWidth={1.9} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[clamp(17px,5cqi,19px)] font-semibold leading-[1.2] tracking-[-0.01em] text-ink">{title}</span>
      <span className="mt-0.5 block text-[clamp(13.5px,3.6cqi,15px)] leading-[1.3] text-mute">{sub}</span>
    </span>
  </div>
);

const RETRY_TIPS = [
  { icon: Sun, label: "Use a well lit area" },
  { icon: ScanFace, label: "Show your full face" },
  { icon: Glasses, label: "No sunglasses or hats" },
  { icon: User, label: "Make sure it's you" },
];

export default function VerificationSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const v = user?.verification || {};
  const status = user?.verified ? "approved" : v.status || "none";
  const back = () => navigate("/settings");

  /* ---- You're verified! ---- */
  if (status === "approved") {
    return (
      <FlowPage onBack={back} backTestId="verification-back-button" testId="verification-settings-page" data-status={status} cta={<FlowButton onClick={back} testId="verification-great-button">Great</FlowButton>}>
        <div className="flex flex-1 flex-col items-center justify-center pb-10 pt-6">
          <StatusCircle tone="ok" icon={Check} size={132} stroke={3} />
          <FlowTitle className="mt-9" testId="verification-state-title">You're verified!</FlowTitle>
          <FlowSub testId="verification-status-text">Your profile is now verified. You can now access all features on voiladi.</FlowSub>
        </div>
      </FlowPage>
    );
  }

  /* ---- Under review ---- */
  if (status === "pending") {
    return (
      <FlowPage onBack={back} backTestId="verification-back-button" testId="verification-settings-page" data-status={status} cta={<FlowButton onClick={back} testId="verification-done-button">Done</FlowButton>}>
        <div className="flex flex-1 flex-col items-center justify-center pt-4">
          <StatusCircle tone="neutral" icon={Clock} size={128} stroke={2.4} />
          <FlowTitle className="mt-9" testId="verification-state-title">Under review</FlowTitle>
          <FlowSub testId="verification-status-text">We're checking your photo. This usually takes a few minutes.</FlowSub>
          <SoftCard className="mt-8 flex w-full items-center gap-5 rounded-[28px] px-6 py-6" testId="verification-review-note">
            <Clock className="h-[30px] w-[30px] shrink-0 text-ink" strokeWidth={2.2} />
            <p className="text-[clamp(17px,5cqi,19px)] leading-[1.35] tracking-[-0.01em] text-mute">You'll get a notification once it's complete.</p>
          </SoftCard>
        </div>
      </FlowPage>
    );
  }

  /* ---- Try again ---- */
  if (status === "rejected") {
    return (
      <FlowPage onBack={back} backTestId="verification-back-button" testId="verification-settings-page" data-status={status} cta={<FlowButton onClick={() => navigate("/verify")} testId="verification-get-verified-button">Try again</FlowButton>}>
        <div className="flex flex-1 flex-col items-center pt-2">
          <StatusCircle tone="bad" icon={X} size={124} stroke={3} />
          <FlowTitle className="mt-7" testId="verification-state-title">Try again</FlowTitle>
          <FlowSub testId="verification-status-text">{v.note || "We couldn't verify your photo. Please make sure it's clear and follow the guidelines."}</FlowSub>
          <div className="mt-7 w-full">
            <TipsCard tips={RETRY_TIPS} dense testId="verification-retry-tips" />
          </div>
        </div>
      </FlowPage>
    );
  }

  /* ---- Verified profile (intro) ---- */
  return (
    <FlowPage
      onBack={back}
      backTestId="verification-back-button"
      testId="verification-settings-page"
      data-status={status}
      cta={
        <FlowButton onClick={() => navigate("/verify")} testId="verification-get-verified-button">
          Get verified
          <ChevronRight className="h-6 w-6" strokeWidth={2.6} />
        </FlowButton>
      }
    >
      <div className="flex flex-col items-center pt-2">
        <StatusCircle tone="neutral" icon={Check} size={124} stroke={3} />
        <FlowTitle className="mt-7" testId="verification-state-title">Verified profile</FlowTitle>
        <span className="vo-soft-pill vo-glass-tint mt-4 h-[42px] px-6 text-[17px] font-semibold text-mute" data-testid="verification-status-pill">
          Not verified
        </span>
        <FlowSub className="mt-4" testId="verification-status-text">Unlock trusted messaging and show others you're real.</FlowSub>
      </div>

      <section className="mt-8">
        <p className="mb-2.5 px-1 text-[13px] font-medium uppercase leading-none tracking-[0.22em] text-mute">What to expect</p>
        <SoftCard className="overflow-hidden rounded-[28px] p-1" testId="verification-steps-card">
          <Expect icon={Camera} title="Take a live selfie" sub="A quick capture to begin verification." />
          <Expect icon={User} title="Follow the prompts" sub="Complete a few simple camera steps." />
          <Expect icon={Clock} title="Submit for review" sub="Your profile status will update to Under review." last />
        </SoftCard>
      </section>
    </FlowPage>
  );
}
