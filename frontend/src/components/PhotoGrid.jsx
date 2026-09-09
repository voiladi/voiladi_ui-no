import React, { useRef, useState } from "react";
import { Plus, X, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { UserPhoto } from "@/components/UserPhoto";

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
      toast.error(`You can add up to ${max} photos`);
      return;
    }
    setUploading(true);
    let current = photos;
    for (const file of files.slice(0, room)) {
      if (!file.type.startsWith("image/")) {
        toast.error("Only images are allowed");
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error("Images must be under 8MB");
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      try {
        const { data } = await api.post("/profile/photos", fd, { headers: { "Content-Type": "multipart/form-data" } });
        current = data.photos;
        onChange(current);
      } catch (err) {
        toast.error(errMsg(err, "Upload failed. Try another photo."));
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
      toast.error(errMsg(err));
    } finally {
      setBusy(null);
    }
  };

  const makeCover = async (url) => {
    const next = [url, ...photos.filter((p) => p !== url)];
    setBusy(url);
    try {
      await api.put("/profile/photos/order", { photos: next });
      onChange(next);
      toast.success("Cover photo updated");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(null);
    }
  };

  const slots = Array.from({ length: max }, (_, i) => photos[i] || null);

  return (
    <div data-testid="photo-grid">
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFile} data-testid="photo-file-input" />
      <div className="grid grid-cols-3 gap-2.5">
        {slots.map((url, i) => {
          const big = i === 0;
          const cls = `${big ? "col-span-2 row-span-2" : "aspect-square"} relative overflow-hidden rounded-[20px] border ${
            url ? "border-line bg-surface2" : "border-dashed border-[#CBD2E0] bg-white"
          }`;
          if (!url) {
            const isNext = i === photos.length;
            return (
              <button
                key={i}
                type="button"
                onClick={pick}
                disabled={uploading}
                className={`${cls} flex items-center justify-center text-mute transition-colors hover:bg-surface2 active:scale-[0.98]`}
                data-testid={isNext ? "onboarding-photo-add-button" : `photo-slot-${i}`}
                aria-label="Add photo"
              >
                {uploading && isNext ? (
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                ) : (
                  <span className={`flex items-center justify-center rounded-full bg-surface2 ${big ? "h-14 w-14" : "h-9 w-9"}`}>
                    <Plus className={big ? "h-7 w-7" : "h-5 w-5"} />
                  </span>
                )}
                {big && !uploading && <span className="absolute bottom-3 text-[13px] font-semibold text-mute">Add your cover photo</span>}
              </button>
            );
          }
          return (
            <div key={url} className={cls} data-testid={`photo-tile-${i}`}>
              <UserPhoto src={url} name="" className="h-full w-full" />
              {busy === url && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink shadow-md transition-colors hover:bg-pass hover:text-white"
                aria-label="Remove photo"
                data-testid={`photo-remove-${i}`}
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
              {big ? (
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold text-ink shadow">
                  <Star className="h-3.5 w-3.5 fill-peach text-peach" /> Cover
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeCover(url)}
                  className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ink shadow transition-colors hover:bg-brand hover:text-white"
                  data-testid={`photo-make-cover-${i}`}
                >
                  Make cover
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-mute">
        {photos.length}/{max} photos. Your first photo is what people see first.
      </p>
    </div>
  );
};
