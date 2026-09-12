import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, MapPin, X } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { notice } from "@/lib/feedback";
import { useAuth } from "@/context/AuthContext";
import { SoftPageHeader, SoftCard } from "@/components/SoftUI";
import { Spinner } from "@/components/Loading";

const CAPTION_MAX = 300;

/* New post: pick a photo, write a caption, add a place, share. */
export default function NewPost() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState(user?.city || "");
  const [busy, setBusy] = useState(false);

  const pick = (f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      notice("Choose a photo");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      notice("Image must be under 8MB");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
  };

  const share = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("caption", caption.trim());
      fd.append("location", location.trim());
      const { data } = await api.post("/posts", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
      qc.invalidateQueries({ queryKey: ["my-posts"] });
      notice("Posted");
      navigate(`/p/${data.id}`, { replace: true });
    } catch (e) {
      notice(errMsg(e, "Couldn't post right now"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vo-neu-page flex min-h-full flex-col px-[clamp(14px,5cqi,20px)] pb-8" data-testid="new-post-page">
      <SoftPageHeader
        title="New post"
        onBack={() => navigate(-1)}
        backTestId="new-post-back-button"
        right={
          <button type="button" onClick={share} disabled={!file || busy} aria-busy={busy} className="inline-flex h-[38px] min-w-[84px] items-center justify-center rounded-full bg-ink px-5 text-[16px] font-semibold text-onink disabled:opacity-40 active:opacity-85" style={{ transitionProperty: "opacity", transitionDuration: "120ms" }} data-testid="new-post-share-button">
            {busy ? <Spinner size={18} stroke={2.4} /> : "Share"}
          </button>
        }
      />

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} data-testid="new-post-file-input" />

      {/* photo */}
      <SoftCard className="mt-3 overflow-hidden p-2" testId="new-post-photo-card">
        {preview ? (
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[20px] bg-black">
            <img src={preview} alt="Your photo" className="h-full w-full object-cover" data-testid="new-post-preview" />
            <button type="button" onClick={clear} aria-label="Remove photo" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur active:opacity-80" data-testid="new-post-remove-photo">
              <X className="h-5 w-5" strokeWidth={2.4} />
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="absolute bottom-3 left-3 inline-flex h-9 items-center rounded-full bg-black/55 px-4 text-[14px] font-semibold text-white backdrop-blur active:opacity-80" data-testid="new-post-change-photo">
              Change
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-[4/5] w-full flex-col items-center justify-center rounded-[20px] bg-surface2 text-ink focus-visible:outline-none active:opacity-90" data-testid="new-post-pick-button">
            <span className="vo-soft-tile h-[64px] w-[64px] rounded-[20px]">
              <ImagePlus className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <span className="mt-4 text-[18px] font-bold tracking-[-0.01em]">Choose a photo</span>
            <span className="mt-1 text-[14.5px] text-mute">From your camera or gallery</span>
          </button>
        )}
      </SoftCard>

      {/* caption */}
      <SoftCard className="mt-3 px-4 py-3" testId="new-post-caption-card">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
          placeholder="Write a caption..."
          rows={3}
          className="w-full resize-none bg-transparent text-[17px] leading-[23px] text-ink placeholder:text-mute focus:outline-none"
          data-testid="new-post-caption-input"
        />
        <div className="mt-1 text-right text-[12.5px] text-mute" data-testid="new-post-caption-count">
          {caption.length}/{CAPTION_MAX}
        </div>
      </SoftCard>

      {/* place */}
      <SoftCard className="mt-3 flex h-[56px] items-center gap-3 px-4" testId="new-post-location-card">
        <MapPin className="h-[22px] w-[22px] shrink-0 text-ink" strokeWidth={1.9} />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value.slice(0, 80))}
          placeholder="Add a place"
          className="min-w-0 flex-1 bg-transparent text-[17px] text-ink placeholder:text-mute focus:outline-none"
          data-testid="new-post-location-input"
        />
        {location && (
          <button type="button" onClick={() => setLocation("")} aria-label="Clear place" className="text-mute active:opacity-60" data-testid="new-post-location-clear">
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        )}
      </SoftCard>
    </div>
  );
}
