import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Camera, RefreshCw, Check, ShieldCheck } from "lucide-react";
import { ModalHeader } from "@/components/EmptyState";
import { Spinner } from "@/components/Loading";
import { SoftCard, SoftPill } from "@/components/SoftUI";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/*
 * Verify your profile: take a live selfie with the front camera (falls back to the device camera picker),
 * review it, submit. A human reviews it; approved -> black tick + messaging unlocked. No automatic face matching.
 */
export default function Verify() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [camera, setCamera] = useState("starting"); // starting | live | unavailable
  const [shot, setShot] = useState(null); // { blob, url }
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const status = user?.verification?.status || "none";

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

  useEffect(() => {
    if (status === "approved" || status === "pending") return undefined;
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        stop();
      },
      "image/jpeg",
      0.9
    );
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setShot({ blob: f, url: URL.createObjectURL(f) });
  };

  const retake = () => {
    if (shot?.url) URL.revokeObjectURL(shot.url);
    setShot(null);
    start();
  };

  const submit = async () => {
    if (!shot) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("file", shot.blob, "selfie.jpg");
      await api.post("/verification/selfie", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await refresh();
      setDone(true);
    } catch (e) {
      notice(errMsg(e));
    } finally {
      setSending(false);
    }
  };

  const Header = (
    <ModalHeader
      left={
        <button type="button" className="-ml-2 flex items-center text-[16px] text-ink" onClick={() => navigate("/profile")} data-testid="verify-back-button">
          <ChevronLeft className="h-5 w-5" strokeWidth={2} /> Back
        </button>
      }
      title="Verify profile"
    />
  );

  /* already verified / in review */
  if (status === "approved" || status === "pending" || done) {
    const approved = status === "approved";
    return (
      <div className="vo-neu-page flex min-h-full flex-col" data-testid="verify-page">
        {Header}
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          <span className={`inline-flex h-20 w-20 items-center justify-center rounded-full ${approved ? "bg-ink text-onink" : "vo-soft text-ink"}`}>
            {approved ? <Check className="h-10 w-10" strokeWidth={3} /> : <ShieldCheck className="h-9 w-9" strokeWidth={1.8} />}
          </span>
          <h1 className="mt-6 text-[clamp(22px,6.5cqi,26px)] font-bold tracking-[-0.02em] text-ink" data-testid="verify-state-title">
            {approved ? "Verified Profile" : "Selfie received"}
          </h1>
          <p className="mt-2 max-w-[300px] text-[16px] leading-[22px] text-mute">
            {approved ? "The black tick now shows on your profile, and you can message your matches." : "We're reviewing it by hand - usually within a day. You'll get a notification when it's done."}
          </p>
          <SoftPill className="mt-8 h-[50px] px-8" onClick={() => navigate("/profile")} testId="verify-done-button">
            Back to profile
          </SoftPill>
        </div>
      </div>
    );
  }

  return (
    <div className="vo-neu-page flex min-h-full flex-col" data-testid="verify-page">
      {Header}
      <div className="flex flex-1 flex-col px-5 pb-8">
        <p className="mt-1 text-[16px] leading-[22px] text-mute">
          {status === "rejected" ? (
            <>
              <span className="font-semibold text-red">We couldn't verify your last selfie.</span> {user?.verification?.note || "Make sure your face is clearly visible and well lit, then try again."}
            </>
          ) : (
            "Take a quick selfie so we know you're real. It's checked by a person at Voiladi, never shown on your profile, and earns you the black tick."
          )}
        </p>

        {/* camera / preview */}
        <SoftCard className="mx-auto mt-5 w-full max-w-[340px] overflow-hidden rounded-[32px] p-2.5" testId="verify-camera-card">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[26px] bg-surface2">
            {shot ? (
              <img src={shot.url} alt="Your selfie" className="h-full w-full object-cover" data-testid="verify-preview" />
            ) : (
              <>
                <video ref={videoRef} playsInline muted autoPlay className={`h-full w-full object-cover ${camera === "live" ? "" : "opacity-0"}`} style={{ transform: "scaleX(-1)" }} data-testid="verify-video" />
                {camera === "starting" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner size={28} stroke={2.5} />
                  </div>
                )}
                {camera === "unavailable" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center" data-testid="verify-camera-unavailable">
                    <Camera className="h-9 w-9 text-mute" strokeWidth={1.6} />
                    <p className="mt-3 text-[15px] font-semibold text-ink">Camera not available here</p>
                    <p className="mt-1 text-[13px] text-mute">Use your phone's camera instead.</p>
                  </div>
                )}
                {/* face guide */}
                {camera === "live" && <span className="pointer-events-none absolute left-1/2 top-1/2 h-[62%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/80" aria-hidden="true" />}
              </>
            )}
          </div>
        </SoftCard>

        <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} data-testid="verify-file-input" />

        <div className="mt-6 flex items-center justify-center gap-5">
          {shot ? (
            <>
              <SoftPill className="h-[52px] px-6" onClick={retake} disabled={sending} testId="verify-retake-button">
                <RefreshCw className="h-5 w-5" strokeWidth={2.2} /> Retake
              </SoftPill>
              <button type="button" onClick={submit} disabled={sending} aria-busy={sending} className="inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-ink px-7 text-[17px] font-semibold text-onink active:scale-[0.97] disabled:opacity-50" style={{ transitionProperty: "transform", transitionDuration: "120ms" }} data-testid="verify-submit-button">
                {sending ? <Spinner size={20} stroke={2.5} /> : <Check className="h-5 w-5" strokeWidth={2.6} />} Submit
              </button>
            </>
          ) : camera === "live" ? (
            <button type="button" onClick={capture} className="vo-soft-round h-[76px] w-[76px]" aria-label="Take selfie" data-testid="verify-capture-button">
              <span className="h-[58px] w-[58px] rounded-full bg-ink" />
            </button>
          ) : camera === "unavailable" ? (
            <SoftPill className="h-[52px] px-7" onClick={() => fileRef.current?.click()} testId="verify-open-camera-button">
              <Camera className="h-5 w-5" strokeWidth={2.2} /> Take a selfie
            </SoftPill>
          ) : null}
        </div>
        {!shot && camera === "live" && <p className="mt-4 text-center text-[14px] text-mute">Centre your face in the oval, then tap the button.</p>}
      </div>
    </div>
  );
}
