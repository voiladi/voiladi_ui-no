import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, RotateCcw, Clock, Sun, Glasses, ScanFace, Scan } from "lucide-react";
import { Spinner } from "@/components/Loading";
import { SoftCard } from "@/components/SoftUI";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { FlowPage, FlowTitle, FlowSub, StatusCircle, TipsCard, FlowButton } from "@/components/verification/VerifyUI";

/*
 * Get verified flow (owner's reference screens):
 *   tips   -> "Verify your identity" + Take selfie
 *   camera -> live front camera (or device camera picker) + shutter
 *   review -> "Review your photo" + Retake / Use this photo
 *   sent   -> "Under review" + Done
 * A person reviews the selfie; approved -> black tick + messaging unlocked. No automatic face matching.
 */

const TIPS = [
  { icon: Sun, label: "Good lighting" },
  { icon: Glasses, label: "No sunglasses" },
  { icon: ScanFace, label: "Look at the camera" },
  { icon: Scan, label: "Keep your face in frame" },
];

export default function Verify() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const status = user?.verified ? "approved" : user?.verification?.status || "none";
  const [step, setStep] = useState(status === "pending" ? "sent" : "tips"); // tips | camera | review | sent
  const [camera, setCamera] = useState("idle"); // idle | starting | live | unavailable
  const [shot, setShot] = useState(null); // { blob, url }
  const [sending, setSending] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = async () => {
    stop();
    setCamera("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera api");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1440 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamera("live");
    } catch (e) {
      setCamera("unavailable");
    }
  };

  useEffect(() => stop, []);
  useEffect(() => {
    if (step === "camera") start();
    else stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    const size = Math.min(v.videoWidth, v.videoHeight);
    c.width = 900;
    c.height = 1200;
    const ctx = c.getContext("2d");
    // mirror like a selfie camera, centre-crop to 3:4
    const sw = size * 0.75;
    const sh = size;
    const sx = (v.videoWidth - sw) / 2;
    const sy = (v.videoHeight - sh) / 2;
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        setShot({ blob, url: URL.createObjectURL(blob) });
        setStep("review");
      },
      "image/jpeg",
      0.9
    );
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setShot({ blob: f, url: URL.createObjectURL(f) });
    setStep("review");
  };

  const retake = () => {
    if (shot?.url) URL.revokeObjectURL(shot.url);
    setShot(null);
    setStep("camera");
  };

  const submit = async () => {
    if (!shot) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("file", shot.blob, "selfie.jpg");
      await api.post("/verification/selfie", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await refresh();
      setStep("sent");
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setSending(false);
    }
  };

  const exit = () => navigate("/settings/verification");
  const back = () => {
    if (step === "review") return retake();
    if (step === "camera") return setStep("tips");
    return exit();
  };

  /* ---- Under review ---- */
  if (step === "sent") {
    return (
      <FlowPage onBack={exit} backTestId="verify-back-button" testId="verify-page" data-step="sent" cta={<FlowButton onClick={exit} testId="verify-done-button">Done</FlowButton>}>
        <div className="flex flex-1 flex-col items-center justify-center pt-4">
          <StatusCircle tone="neutral" icon={Clock} size={128} stroke={2.4} />
          <FlowTitle className="mt-9" testId="verify-state-title">Under review</FlowTitle>
          <FlowSub>We're checking your photo. This usually takes a few minutes.</FlowSub>
          <SoftCard className="mt-8 flex w-full items-center gap-5 rounded-[28px] px-6 py-6" testId="verify-review-note">
            <Clock className="h-[30px] w-[30px] shrink-0 text-ink" strokeWidth={2.2} />
            <p className="text-[clamp(17px,5cqi,19px)] leading-[1.35] tracking-[-0.01em] text-mute">You'll get a notification once it's complete.</p>
          </SoftCard>
        </div>
      </FlowPage>
    );
  }

  /* ---- Review your photo ---- */
  if (step === "review" && shot) {
    return (
      <FlowPage
        onBack={back}
        backTestId="verify-back-button"
        testId="verify-page"
        data-step="review"
        cta={
          <FlowButton onClick={submit} busy={sending} testId="verify-submit-button">
            {sending ? <Spinner size={22} stroke={2.5} /> : "Use this photo"}
          </FlowButton>
        }
      >
        <div className="flex flex-1 flex-col items-center pt-2">
          <FlowTitle testId="verify-state-title">Review your photo</FlowTitle>
          <FlowSub>Make sure your photo is clear and matches your appearance.</FlowSub>
          <div className="mt-6 w-full max-w-[340px] overflow-hidden rounded-[32px] bg-surface2 shadow-[var(--soft-shadow)]">
            <img src={shot.url} alt="Your selfie" className="block aspect-square w-full object-cover" data-testid="verify-preview" />
          </div>
          <button type="button" onClick={retake} disabled={sending} className="mt-6 inline-flex items-center gap-3 text-[clamp(18px,5.2cqi,20px)] font-medium text-ink active:opacity-60 focus-visible:outline-none" data-testid="verify-retake-button">
            <RotateCcw className="h-7 w-7" strokeWidth={2.2} /> Retake
          </button>
        </div>
      </FlowPage>
    );
  }

  /* ---- Camera ---- */
  if (step === "camera") {
    return (
      <FlowPage
        onBack={back}
        backTestId="verify-back-button"
        testId="verify-page"
        data-step="camera"
        cta={
          camera === "unavailable" ? (
            <FlowButton onClick={() => fileRef.current?.click()} testId="verify-open-camera-button">
              <Camera className="h-6 w-6" strokeWidth={2.2} /> Open camera
            </FlowButton>
          ) : (
            <div className="flex justify-center">
              <button type="button" onClick={capture} disabled={camera !== "live"} className="vo-soft-round h-[80px] w-[80px] disabled:opacity-50" aria-label="Take selfie" data-testid="verify-capture-button">
                <span className="h-[62px] w-[62px] rounded-full bg-ink" />
              </button>
            </div>
          )
        }
      >
        <div className="flex flex-1 flex-col items-center pt-2">
          <FlowTitle testId="verify-state-title">Take a selfie</FlowTitle>
          <FlowSub>Centre your face in the frame and look at the camera.</FlowSub>
          <div className="relative mt-6 aspect-square w-full max-w-[340px] overflow-hidden rounded-[32px] bg-surface2 shadow-[var(--soft-shadow)]" data-testid="verify-camera-card">
            <video ref={videoRef} playsInline muted autoPlay className={`h-full w-full object-cover ${camera === "live" ? "" : "opacity-0"}`} style={{ transform: "scaleX(-1)" }} data-testid="verify-video" />
            {camera !== "live" && camera !== "unavailable" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner size={28} stroke={2.5} />
              </div>
            )}
            {camera === "unavailable" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center" data-testid="verify-camera-unavailable">
                <Camera className="h-10 w-10 text-mute" strokeWidth={1.6} />
                <p className="mt-3 text-[17px] font-semibold text-ink">Camera not available here</p>
                <p className="mt-1 text-[14px] text-mute">Use your phone's camera instead.</p>
              </div>
            )}
            {camera === "live" && <span className="pointer-events-none absolute left-1/2 top-1/2 h-[74%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/85" aria-hidden="true" />}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} data-testid="verify-file-input" />
        </div>
      </FlowPage>
    );
  }

  /* ---- Verify your identity (tips) ---- */
  return (
    <FlowPage onBack={exit} backTestId="verify-back-button" testId="verify-page" data-step="tips" cta={<FlowButton onClick={() => setStep("camera")} testId="verify-start-button">Take selfie</FlowButton>}>
      <div className="flex flex-1 flex-col pt-[clamp(28px,9cqi,52px)]">
        <FlowTitle testId="verify-state-title">Verify your identity</FlowTitle>
        <FlowSub>Take a clear selfie so we can confirm it's you.</FlowSub>
        <div className="mt-8">
          <TipsCard tips={TIPS} testId="verify-tips" />
        </div>
      </div>
    </FlowPage>
  );
}
