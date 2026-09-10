import React, { useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Spinner } from "@/components/Loading";
import { notice } from "@/lib/feedback";
import { api, errMsg } from "@/lib/api";
import { UserPhoto } from "@/components/UserPhoto";

/* Edit Profile photos as photographed: big main photo + "Add Photo" tile, then small tiles with a minus badge. */
export const PhotoGrid = ({ photos = [], onChange, max = 6 }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(null);

  const pick = () => inputRef.current?.click();

  const onFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const room = max - photos.length;
    if (room <= 0) {
      notice(`You can add up to ${max} photos`);
      return;
    }
    setUploading(true);
    let current = photos;
    for (const file of files.slice(0, room)) {
      if (!file.type.startsWith("image/")) {
        notice("Only images are allowed");
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        notice("Images must be under 8MB");
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      try {
        const { data } = await api.post("/profile/photos", fd, { headers: { "Content-Type": "multipart/form-data" } });
        current = data.photos;
        onChange(current);
      } catch (err) {
        notice(errMsg(err, "Upload failed. Try another photo."));
      }
    }
    setUploading(false);
  };

  const remove = async (url) => {
    setBusy(url);
    try {
      const { data } = await api.delete("/profile/photos", { params: { url } });
      onChange(data.photos);
    } catch (err) {
      notice(errMsg(err));
    } finally {
      setBusy(null);
    }
  };

  const makeMain = async (url) => {
    const next = [url, ...photos.filter((p) => p !== url)];
    setBusy(url);
    try {
      await api.put("/profile/photos/order", { photos: next });
      onChange(next);
    } catch (err) {
      notice(errMsg(err));
    } finally {
      setBusy(null);
    }
  };

  const main = photos[0];
  const rest = photos.slice(1);
  const full = photos.length >= max;

  const RemoveBadge = ({ url, i }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        remove(url);
      }}
      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-onink ring-2 ring-bg"
      aria-label="Remove photo"
      data-testid={`photo-remove-${i}`}
    >
      {busy === url ? <Spinner size={14} stroke={2} /> : <Minus className="h-3.5 w-3.5" strokeWidth={3} />}
    </button>
  );

  return (
    <div data-testid="photo-grid">
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFile} data-testid="photo-file-input" />
      <div className="grid grid-cols-2 gap-3">
        {main ? (
          <div className="relative aspect-square overflow-hidden rounded-[20px] bg-surface2" data-testid="photo-tile-0">
            <UserPhoto src={main} name="" size="md" className="h-full w-full" />
            <RemoveBadge url={main} i={0} />
          </div>
        ) : (
          <button type="button" onClick={pick} disabled={uploading} aria-busy={uploading} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[20px] bg-surface text-ink" data-testid="onboarding-photo-add-button" aria-label="Add photo">
            {uploading ? <Spinner size={24} stroke={2} /> : <Plus className="h-7 w-7" strokeWidth={1.75} />}
            <span className="text-[13px] font-medium text-mute">Add Photo</span>
          </button>
        )}
        <button
          type="button"
          onClick={pick}
          disabled={uploading || full}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[20px] bg-surface text-ink disabled:opacity-50"
          data-testid={main ? "onboarding-photo-add-button" : "photo-add-button-secondary"}
          aria-label="Add photo"
        >
          {uploading ? <Spinner size={24} stroke={2} /> : <Plus className="h-7 w-7" strokeWidth={1.75} />}
          <span className="text-[13px] font-medium text-mute">{full ? "Max photos" : "Add Photo"}</span>
        </button>
      </div>
      {rest.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {rest.map((url, i) => (
            <button key={url} type="button" onClick={() => makeMain(url)} className="relative aspect-square overflow-hidden rounded-[16px] bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue" title="Set as main photo" data-testid={`photo-tile-${i + 1}`}>
              <UserPhoto src={url} name="" size="sm" className="h-full w-full" />
              <RemoveBadge url={url} i={i + 1} />
            </button>
          ))}
        </div>
      )}
      <p className="mt-2.5 text-[12px] text-mute">
        {photos.length}/{max} photos. Tap a small photo to make it your main one.
      </p>
    </div>
  );
};
