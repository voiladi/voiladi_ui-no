import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ChevronLeft, ChevronDown, ChevronRight, Camera, Images, ImagePlus, MapPin, UserRound, SlidersHorizontal, Maximize2, Minimize2, Volume2, VolumeX, Check, Play } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { notice } from "@/lib/feedback";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/Loading";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/Dialogs";
import { CropView } from "@/components/post/CropView";
import { EditTabs, FilterStrip, AdjustList, CropControls } from "@/components/post/PhotoEditor";
import { TagPeopleSheet } from "@/components/post/TagPeopleSheet";
import { LocationSheet } from "@/components/post/LocationSheet";
import { isVideoFile, isImageFile, probeVideoDuration, formatDuration, uploadPostVideo, POST_VIDEO_MAX_SECONDS, POST_VIDEO_MAX_BYTES } from "@/lib/media";
import { DEFAULT_CROP, DEFAULT_ADJUST, loadImage, exportEditedImage, cssFilter, overlayStyle } from "@/lib/imageEdit";

const CAPTION_MAX = 300;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const PICK_MAX = 30;

/*
 * New post - Instagram flow in three steps:
 *   1. Pick     X | New post | Next      big square preview on top, "Recents" + your picks in a 4-column grid below
 *   2. Edit     <  | Edit     | Next      crop (pinch / drag, aspect chips), filters, adjust sliders
 *   3. Details  <  | New post             thumbnail + "Write a caption...", Add location / Tag people / Advanced
 *                                         settings rows, full-width blue Share pinned to the bottom
 */
export default function NewPost() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);

  const [step, setStep] = useState("pick");
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [muted, setMuted] = useState(true);
  const [editTab, setEditTab] = useState("filter");
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(null); // { file, url } - the baked photo shown on Details and uploaded
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [tagged, setTagged] = useState([]);
  const [hideLikes, setHideLikes] = useState(false);
  const [commentsOff, setCommentsOff] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [sheet, setSheet] = useState(null); // "tag" | "location"
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const selected = items.find((i) => i.id === selectedId) || null;
  const isVideo = selected?.kind === "video";

  // places you've used before -> suggestions in the location sheet
  const myPosts = useQuery({ queryKey: ["my-posts"], queryFn: async () => (await api.get("/posts/mine")).data.posts, enabled: !!user, staleTime: 60_000 });
  const placeSuggestions = useMemo(() => [user?.city, ...(myPosts.data || []).map((p) => p.location)].filter(Boolean), [user?.city, myPosts.data]);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);
  useEffect(() => () => exported?.url && URL.revokeObjectURL(exported.url), [exported]);

  const patchSelected = (changes) => setItems((list) => list.map((i) => (i.id === selectedId ? { ...i, ...changes } : i)));

  /* ---------- picking ---------- */
  const addFiles = async (files) => {
    const list = [...(files || [])].slice(0, PICK_MAX);
    const fresh = [];
    for (const f of list) {
      if (isVideoFile(f)) {
        if (f.size > POST_VIDEO_MAX_BYTES) {
          notice("That video is too large (max 300 MB)");
          continue;
        }
        const d = await probeVideoDuration(f);
        if (d && d > POST_VIDEO_MAX_SECONDS + 0.5) {
          notice(`Videos can be up to ${POST_VIDEO_MAX_SECONDS} seconds`);
          continue;
        }
        fresh.push({ id: `${Date.now()}-${fresh.length}-${Math.random().toString(36).slice(2, 7)}`, file: f, url: URL.createObjectURL(f), kind: "video", duration: d });
      } else if (isImageFile(f)) {
        if (f.size > IMAGE_MAX_BYTES) {
          notice("Image must be under 8MB");
          continue;
        }
        const url = URL.createObjectURL(f);
        let iw = 0;
        let ih = 0;
        try {
          const img = await loadImage(url);
          iw = img.naturalWidth;
          ih = img.naturalHeight;
        } catch (e) {
          URL.revokeObjectURL(url);
          notice("Couldn't read that photo");
          continue;
        }
        fresh.push({ id: `${Date.now()}-${fresh.length}-${Math.random().toString(36).slice(2, 7)}`, file: f, url, kind: "image", iw, ih, crop: { ...DEFAULT_CROP }, filterId: "normal", adjust: { ...DEFAULT_ADJUST } });
      } else {
        notice("Choose a photo or a video");
      }
    }
    if (!fresh.length) return;
    setItems((cur) => [...fresh, ...cur].slice(0, PICK_MAX));
    setSelectedId(fresh[0].id);
    setExported(null);
  };

  const onInput = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const toggleAspect = () => selected && patchSelected({ crop: { ...selected.crop, aspect: selected.crop.aspect ? null : 1, zoom: 1, nx: 0, ny: 0 } });

  /* ---------- steps ---------- */
  const goEdit = () => {
    if (!selected) return;
    if (isVideo) {
      setExported(null);
      setStep("details");
      return;
    }
    setEditTab("filter");
    setStep("edit");
  };

  const finishEdit = async () => {
    if (!selected || exporting) return;
    setExporting(true);
    try {
      const file = await exportEditedImage(selected.file, selected);
      setExported({ file, url: URL.createObjectURL(file) });
      setStep("details");
    } catch (e) {
      notice(e?.message || "Couldn't process that photo");
    } finally {
      setExporting(false);
    }
  };

  const close = () => {
    if (items.length) setDiscard(true);
    else navigate(-1);
  };

  /* ---------- share ---------- */
  const share = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setProgress(0);
    const tagIds = tagged.map((t) => t.id);
    try {
      let data;
      if (isVideo) {
        data = await uploadPostVideo({ file: selected.file, caption: caption.trim(), location: location.trim(), duration: selected.duration, tagged: tagIds, hideLikes, commentsOff, onProgress: setProgress });
      } else {
        const fd = new FormData();
        fd.append("file", exported?.file || selected.file);
        fd.append("caption", caption.trim());
        fd.append("location", location.trim());
        fd.append("tagged", tagIds.join(","));
        fd.append("hide_likes", hideLikes ? "true" : "false");
        fd.append("comments_off", commentsOff ? "true" : "false");
        const res = await api.post("/posts", fd, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120000,
          onUploadProgress: (e) => e.total && setProgress(Math.min(0.99, e.loaded / e.total)),
        });
        data = res.data;
      }
      qc.invalidateQueries({ queryKey: ["my-posts"] });
      notice(isVideo ? "Posting your video..." : "Posted");
      navigate(`/p/${data.id}`, { replace: true });
    } catch (e) {
      notice(errMsg(e, "Couldn't post right now"));
    } finally {
      setBusy(false);
    }
  };

  const nextLabel = (onClick, disabled, loading, testId) => (
    <button type="button" onClick={onClick} disabled={disabled || loading} className="flex h-10 min-w-[56px] items-center justify-end text-[16px] font-semibold text-blue disabled:opacity-40 active:opacity-60 focus-visible:outline-none" style={{ transitionProperty: "opacity", transitionDuration: "120ms" }} data-testid={testId}>
      {loading ? <Spinner size={18} stroke={2.4} className="text-blue" /> : "Next"}
    </button>
  );

  /* ================================================================ step 1: pick */
  if (step === "pick") {
    return (
      <div className="vo-neu-page flex h-full flex-col" data-testid="new-post-page" data-step="pick">
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 pt-1" data-testid="new-post-header">
          <button type="button" onClick={close} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center text-ink active:opacity-60 focus-visible:outline-none" data-testid="new-post-close-button">
            <X className="h-[26px] w-[26px]" strokeWidth={2.2} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[20px] font-bold leading-none tracking-[-0.02em] text-ink">New post</h1>
          {nextLabel(goEdit, !selected, false, "new-post-next-button")}
        </header>

        <input ref={galleryRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onInput} data-testid="new-post-file-input" />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onInput} data-testid="new-post-camera-input" />

        {/* big preview */}
        <div className="relative shrink-0 bg-black" data-testid="new-post-preview-box">
          {!selected ? (
            <button type="button" onClick={() => galleryRef.current?.click()} className="flex aspect-square w-full flex-col items-center justify-center bg-surface2 text-ink focus-visible:outline-none active:opacity-90" data-testid="new-post-pick-button">
              <span className="vo-soft-tile h-[64px] w-[64px] rounded-[20px]">
                <ImagePlus className="h-7 w-7" strokeWidth={1.8} />
              </span>
              <span className="mt-4 text-[17px] font-bold tracking-[-0.01em]">Select from gallery</span>
              <span className="mt-1 text-[14px] text-mute">Photos, or videos up to {POST_VIDEO_MAX_SECONDS} seconds</span>
            </button>
          ) : isVideo ? (
            <div className="relative aspect-square w-full">
              <video key={selected.id} src={selected.url} className="h-full w-full object-contain" autoPlay muted={muted} loop playsInline data-testid="new-post-video-preview" />
              <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur active:opacity-80" data-testid="new-post-mute-toggle">
                {muted ? <VolumeX className="h-[16px] w-[16px]" strokeWidth={2.2} /> : <Volume2 className="h-[16px] w-[16px]" strokeWidth={2.2} />}
              </button>
              {selected.duration ? (
                <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[12.5px] font-semibold text-white backdrop-blur" data-testid="new-post-duration">
                  {formatDuration(selected.duration)}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="relative aspect-square w-full">
              <div className="absolute inset-0 flex items-center justify-center">
                <div style={{ width: selected.crop.aspect && selected.crop.aspect < 1 ? `${selected.crop.aspect * 100}%` : "100%" }}>
                  <CropView key={selected.id} src={selected.url} iw={selected.iw} ih={selected.ih} crop={selected.crop} onChange={(crop) => patchSelected({ crop })} filterId={selected.filterId} adjust={selected.adjust} testId="new-post-crop" />
                </div>
              </div>
              <button type="button" onClick={toggleAspect} aria-label={selected.crop.aspect ? "Show whole photo" : "Crop to square"} aria-pressed={!selected.crop.aspect} className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur active:opacity-80" data-testid="new-post-expand-toggle">
                {selected.crop.aspect ? <Maximize2 className="h-[15px] w-[15px]" strokeWidth={2.4} /> : <Minimize2 className="h-[15px] w-[15px]" strokeWidth={2.4} />}
              </button>
            </div>
          )}
        </div>

        {/* Recents + grid */}
        <div className="flex h-[50px] shrink-0 items-center justify-between px-4" data-testid="new-post-recents-bar">
          <button type="button" onClick={() => galleryRef.current?.click()} className="inline-flex items-center gap-1 text-[16px] font-bold tracking-[-0.01em] text-ink active:opacity-60 focus-visible:outline-none" data-testid="new-post-recents-button">
            Recents
            <ChevronDown className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => galleryRef.current?.click()} aria-label="Add from gallery" className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface2 text-ink active:opacity-70 focus-visible:outline-none" data-testid="new-post-gallery-button">
              <Images className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
            <button type="button" onClick={() => cameraRef.current?.click()} aria-label="Take a photo" className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface2 text-ink active:opacity-70 focus-visible:outline-none" data-testid="new-post-camera-button">
              <Camera className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="vo-scroll min-h-0 flex-1 overflow-y-auto pb-[calc(12px+var(--safe-bottom))]" data-testid="new-post-grid-scroll">
          <div className="grid grid-cols-4 gap-[2px]" data-testid="new-post-grid">
            <button type="button" onClick={() => cameraRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 bg-surface2 text-ink active:opacity-70 focus-visible:outline-none" data-testid="new-post-grid-camera">
              <Camera className="h-7 w-7" strokeWidth={1.7} />
            </button>
            <button type="button" onClick={() => galleryRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 bg-surface2 text-ink active:opacity-70 focus-visible:outline-none" data-testid="new-post-grid-gallery">
              <ImagePlus className="h-7 w-7" strokeWidth={1.7} />
              <span className="text-[11.5px] font-semibold text-mute">Gallery</span>
            </button>
            {items.map((it) => {
              const on = it.id === selectedId;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(it.id);
                    setExported(null);
                  }}
                  className="relative aspect-square overflow-hidden bg-surface2 focus-visible:outline-none"
                  aria-pressed={on}
                  data-testid="new-post-grid-item"
                  data-kind={it.kind}
                >
                  {it.kind === "video" ? (
                    <video src={it.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    <img src={it.url} alt="" draggable={false} className="h-full w-full object-cover" style={{ filter: cssFilter(it.filterId, it.adjust) || undefined }} />
                  )}
                  {it.kind === "video" && (
                    <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      <Play className="h-[10px] w-[10px]" fill="currentColor" strokeWidth={0} />
                      {formatDuration(it.duration || 0)}
                    </span>
                  )}
                  <span className={`absolute inset-0 bg-white/45 ${on ? "opacity-100" : "opacity-0"}`} style={{ transitionProperty: "opacity", transitionDuration: "150ms" }} aria-hidden="true" />
                  <span className={`absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-white ${on ? "bg-blue text-white" : "bg-black/25"}`} aria-hidden="true">
                    {on && <Check className="h-[13px] w-[13px]" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
          {items.length === 0 && (
            <p className="mt-6 px-8 text-center text-[13.5px] leading-[18px] text-mute" data-testid="new-post-grid-hint">
              Tap Gallery to pick photos and videos from your phone. Everything you pick shows up here.
            </p>
          )}
        </div>

        <ConfirmDialog open={discard} onOpenChange={setDiscard} title="Discard post?" description="If you leave now, your edits won't be saved." confirmText="Discard" danger onConfirm={() => navigate(-1)} testId="discard-post-dialog" />
      </div>
    );
  }

  /* ================================================================ step 2: edit */
  if (step === "edit" && selected && !isVideo) {
    return (
      <div className="vo-neu-page flex h-full flex-col" data-testid="new-post-page" data-step="edit">
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 pt-1" data-testid="new-post-header">
          <button type="button" onClick={() => setStep("pick")} aria-label="Back" className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center text-ink active:opacity-60 focus-visible:outline-none" data-testid="new-post-edit-back">
            <ChevronLeft className="h-7 w-7" strokeWidth={2.4} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[20px] font-bold leading-none tracking-[-0.02em] text-ink">Edit</h1>
          {nextLabel(finishEdit, false, exporting, "new-post-edit-next")}
        </header>

        <div className="vo-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center justify-center bg-black">
            <CropView key={selected.id} src={selected.url} iw={selected.iw} ih={selected.ih} crop={selected.crop} onChange={(crop) => patchSelected({ crop })} filterId={selected.filterId} adjust={selected.adjust} testId="new-post-edit-crop" />
          </div>
          {editTab === "filter" && <FilterStrip src={selected.url} value={selected.filterId} onChange={(filterId) => patchSelected({ filterId })} />}
          {editTab === "adjust" && <AdjustList value={selected.adjust} onChange={(adjust) => patchSelected({ adjust })} />}
          {editTab === "crop" && <CropControls crop={selected.crop} iw={selected.iw} ih={selected.ih} onChange={(crop) => patchSelected({ crop })} />}
        </div>

        <div className="shrink-0 pb-[var(--safe-bottom)]">
          <EditTabs value={editTab} onChange={setEditTab} />
        </div>
      </div>
    );
  }

  /* ================================================================ step 3: details */
  const thumbUrl = exported?.url || selected?.url;
  const tagSummary = tagged.length === 0 ? "" : tagged.length === 1 ? tagged[0].username || tagged[0].name : `${tagged.length} people`;

  return (
    <div className="vo-neu-page flex h-full flex-col" data-testid="new-post-page" data-step="details">
      <header className="flex h-14 shrink-0 items-center gap-2 px-3 pt-1" data-testid="new-post-header">
        <button type="button" onClick={() => setStep(isVideo ? "pick" : "edit")} aria-label="Back" className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center text-ink active:opacity-60 focus-visible:outline-none" data-testid="new-post-back-button">
          <ChevronLeft className="h-7 w-7" strokeWidth={2.4} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-bold leading-none tracking-[-0.02em] text-ink">New post</h1>
      </header>

      <div className="vo-scroll min-h-0 flex-1 overflow-y-auto px-4">
        {/* thumbnail + caption */}
        <div className="flex items-start gap-3 pt-2" data-testid="new-post-caption-card">
          <div className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-[8px] bg-black" data-testid="new-post-thumb">
            {isVideo ? (
              <video src={selected?.url} muted playsInline preload="metadata" className="h-full w-full object-cover" data-testid="new-post-video-preview" />
            ) : exported ? (
              <img src={thumbUrl} alt="Your photo" className="h-full w-full object-cover" data-testid="new-post-preview" />
            ) : (
              <>
                <img src={thumbUrl} alt="Your photo" className="h-full w-full object-cover" style={{ filter: cssFilter(selected?.filterId, selected?.adjust) || undefined }} data-testid="new-post-preview" />
                {overlayStyle(selected?.adjust) && <div className="pointer-events-none absolute inset-0" style={overlayStyle(selected?.adjust)} aria-hidden="true" />}
              </>
            )}
            {isVideo && (
              <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10.5px] font-semibold text-white" data-testid="new-post-duration">
                {formatDuration(selected?.duration || 0)}
              </span>
            )}
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
            placeholder="Write a caption..."
            rows={3}
            className="min-h-[80px] w-full resize-none bg-transparent pt-1 text-[16px] leading-[22px] text-ink placeholder:text-mute focus:outline-none"
            data-testid="new-post-caption-input"
          />
        </div>
        <div className={`mt-1 text-right text-[12px] tabular-nums ${caption.length >= CAPTION_MAX ? "text-red" : "text-mute"} ${caption.length > CAPTION_MAX - 60 ? "opacity-100" : "opacity-0"}`} style={{ transitionProperty: "opacity", transitionDuration: "150ms" }} data-testid="new-post-caption-count">
          {caption.length}/{CAPTION_MAX}
        </div>

        {/* option rows */}
        <div className="mt-2 border-t border-line/70" data-testid="new-post-options">
          <DetailRow
            icon={MapPin}
            label={location || "Add location"}
            onClick={() => setSheet("location")}
            testId="new-post-location-row"
            right={
              location ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation("");
                  }}
                  aria-label="Remove location"
                  className="flex h-8 w-8 items-center justify-center text-mute active:opacity-60"
                  data-testid="new-post-location-clear"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </button>
              ) : undefined
            }
          />
          <DetailRow icon={UserRound} label="Tag people" value={tagSummary} onClick={() => setSheet("tag")} testId="new-post-tag-row" />
          <DetailRow
            icon={SlidersHorizontal}
            label="Advanced settings"
            onClick={() => setAdvanced((a) => !a)}
            testId="new-post-advanced-row"
            right={<ChevronRight className="h-[20px] w-[20px] text-mute" strokeWidth={2} style={{ transform: advanced ? "rotate(90deg)" : "none", transitionProperty: "transform", transitionDuration: "180ms" }} />}
            last
          />
          {advanced && (
            <div className="border-t border-line/70 pb-2 pt-3" data-testid="new-post-advanced">
              <ToggleBlock
                title="Hide like and view counts on this post"
                description="Only you will see the total number of likes and views on this post. You can change this later from the ··· menu."
                checked={hideLikes}
                onChange={setHideLikes}
                testId="new-post-hide-likes"
              />
              <ToggleBlock
                title="Turn off commenting"
                description="You can change this later by going to the ··· menu at the top of your post."
                checked={commentsOff}
                onChange={setCommentsOff}
                testId="new-post-comments-off"
              />
            </div>
          )}
        </div>
      </div>

      {/* pinned share */}
      <div className="shrink-0 border-t border-line/60 px-4 pt-3 pb-[calc(12px+var(--safe-bottom))]" data-testid="new-post-share-bar">
        <button
          type="button"
          onClick={share}
          disabled={!selected || busy}
          aria-busy={busy}
          className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-blue text-[16px] font-semibold text-white disabled:opacity-50 active:opacity-85 focus-visible:outline-none"
          style={{ transitionProperty: "opacity", transitionDuration: "120ms" }}
          data-testid="new-post-share-button"
        >
          {busy ? (
            <>
              <Spinner size={18} stroke={2.4} className="text-white" />
              {progress > 0 && progress < 1 ? `${Math.round(progress * 100)}%` : "Sharing..."}
            </>
          ) : (
            "Share"
          )}
        </button>
      </div>

      <TagPeopleSheet open={sheet === "tag"} onOpenChange={(o) => !o && setSheet(null)} selected={tagged} onChange={setTagged} />
      <LocationSheet open={sheet === "location"} onOpenChange={(o) => !o && setSheet(null)} value={location} onChange={setLocation} suggestions={placeSuggestions} />
    </div>
  );
}

/* Flat Instagram row: icon | label | value | chevron */
const DetailRow = ({ icon: Icon, label, value, onClick, right, testId, last = false }) => (
  <button type="button" onClick={onClick} className={`flex min-h-[54px] w-full items-center gap-3.5 py-2 text-left focus-visible:outline-none active:opacity-75 ${last ? "" : "border-b border-line/70"}`} data-testid={testId}>
    <Icon className="h-[24px] w-[24px] shrink-0 text-ink" strokeWidth={1.9} />
    <span className="min-w-0 flex-1 truncate text-[16px] font-medium tracking-[-0.01em] text-ink">{label}</span>
    {value ? (
      <span className="max-w-[45%] truncate text-[14.5px] text-mute" data-testid={testId ? `${testId}-value` : undefined}>
        {value}
      </span>
    ) : null}
    {right !== undefined ? right : <ChevronRight className="h-[20px] w-[20px] shrink-0 text-mute" strokeWidth={2} />}
  </button>
);

const ToggleBlock = ({ title, description, checked, onChange, testId }) => (
  <div className="flex items-start gap-4 py-2.5" data-testid={testId}>
    <div className="min-w-0 flex-1">
      <p className="text-[15.5px] font-medium leading-[20px] tracking-[-0.01em] text-ink">{title}</p>
      <p className="mt-1 text-[13px] leading-[17px] text-mute">{description}</p>
    </div>
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      aria-label={title}
      className="mt-0.5 h-[31px] w-[51px] shrink-0 data-[state=checked]:bg-blue data-[state=unchecked]:bg-surface2 [&>span]:h-[27px] [&>span]:w-[27px] [&>span]:data-[state=checked]:translate-x-[20px]"
      data-testid={`${testId}-switch`}
    />
  </div>
);
