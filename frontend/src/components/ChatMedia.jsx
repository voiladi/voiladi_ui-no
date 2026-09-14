import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Play, Eye, Clock, Image as ImageIcon, Film, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Spinner } from "@/components/Loading";
import { mediaUrl, formatDuration, isVideoFile } from "@/lib/media";

/*
 * Chat media: bubbles for photos / videos (normal + view once), the pre-send preview sheet, and the full-screen viewer.
 * Visual language matches the chat: raised soft tiles, ink pills, no chrome beyond what Instagram would show.
 */

/* ------------------------------------------------------------------ pre-send sheet */

export const MediaPreviewSheet = ({ file, open, onOpenChange, onSend, duration, tooLong }) => {
  const [viewOnce, setViewOnce] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) return undefined;
    const u = URL.createObjectURL(file);
    setUrl(u);
    setViewOnce(false);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const video = isVideoFile(file);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-[430px] rounded-t-[28px] border-0 bg-canvas" data-testid="media-preview-sheet">
        <DrawerTitle className="sr-only">Send {video ? "video" : "photo"}</DrawerTitle>
        <DrawerDescription className="sr-only">Preview before sending</DrawerDescription>
        <div className="px-5 pb-8 pt-3">
          <div className="vo-soft-sunken relative flex max-h-[52dvh] items-center justify-center overflow-hidden rounded-[22px] bg-black/5">
            {video ? (
              <video src={url} className="max-h-[52dvh] w-full object-contain" playsInline muted controls preload="metadata" data-testid="media-preview-video" />
            ) : (
              <img src={url} alt="" className="max-h-[52dvh] w-full object-contain" data-testid="media-preview-image" />
            )}
            {video && duration ? <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-semibold text-white">{formatDuration(duration)}</span> : null}
          </div>
          {tooLong ? (
            <p className="mt-3 text-[14px] font-medium text-red" role="alert" data-testid="media-preview-error">
              Videos can be up to 5 minutes. Trim it and try again.
            </p>
          ) : (
            <>
              <div className="vo-soft mt-4 flex items-center gap-3 rounded-[20px] px-4 py-3">
                <span className="vo-soft-tile h-[38px] w-[38px] rounded-[12px]">
                  <Eye className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold leading-[20px] tracking-[-0.01em] text-ink">View once</span>
                  <span className="block text-[13px] leading-[17px] text-mute">They can open it one time, then it disappears.</span>
                </span>
                <Switch checked={viewOnce} onCheckedChange={setViewOnce} aria-label="View once" className="data-[state=checked]:bg-ink" data-testid="media-view-once-switch" />
              </div>
              <p className="mt-3 px-1 text-center text-[12.5px] leading-[17px] text-mute">{video ? "Sent in 720p. Larger videos are compressed after upload." : "Photos are sent up to 1280px."}</p>
              <button type="button" onClick={() => onSend({ viewOnce })} className="mt-4 inline-flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[17px] font-semibold text-onink active:scale-[0.98]" style={{ transitionProperty: "transform", transitionDuration: "120ms" }} data-testid="media-send-button">
                Send {video ? "video" : "photo"}
              </button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

/* ------------------------------------------------------------------ full-screen viewer */

export const MediaViewer = ({ item, onClose }) => {
  // item: { kind: 'image'|'video', url, viewOnce, name }
  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);
  return createPortal(
    <AnimatePresence>
      {item && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="fixed inset-0 z-[300] flex flex-col bg-black" data-testid="media-viewer" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between px-3" style={{ paddingTop: "calc(10px + var(--safe-top))" }}>
            <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20" aria-label="Close" data-testid="media-viewer-close">
              <X className="h-6 w-6" strokeWidth={2.2} />
            </button>
            <span className="text-[14px] font-medium text-white/80">{item.viewOnce ? "View once" : item.name || ""}</span>
            {!item.viewOnce ? (
              <a href={item.url} download target="_blank" rel="noreferrer" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20" aria-label="Save" data-testid="media-viewer-save">
                <Download className="h-5 w-5" strokeWidth={2.2} />
              </a>
            ) : (
              <span className="h-11 w-11" />
            )}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center" style={{ touchAction: "pinch-zoom" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
            {item.kind === "video" ? (
              <video src={item.url} className="max-h-full max-w-full" controls autoPlay playsInline controlsList={item.viewOnce ? "nodownload" : undefined} data-testid="media-viewer-video" />
            ) : (
              <img src={item.url} alt="" className="max-h-full max-w-full select-none object-contain" draggable={false} data-testid="media-viewer-image" />
            )}
          </div>
          <div style={{ height: "var(--safe-bottom)" }} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

/* ------------------------------------------------------------------ bubbles */

const tileSize = (w, h, max = 240) => {
  if (!w || !h) return { width: max, height: Math.round(max * 1.25) };
  const r = w / h;
  return r >= 1 ? { width: max, height: Math.round(max / r) } : { width: Math.round(max * r), height: max };
};

/** A normal photo / video message. Tap to open full-screen. Videos show the poster + duration. */
export const MediaBubble = ({ m, mine, onOpen, onRetry }) => {
  const media = m.media || {};
  const size = tileSize(media.width, media.height);
  const status = media.status || "ready";
  const uploading = m.pending && typeof m.progress === "number";

  return (
    <button
      type="button"
      onClick={() => status === "ready" && !uploading && onOpen({ kind: media.kind, url: mediaUrl(media.url) })}
      className={`relative block overflow-hidden text-left focus-visible:outline-none ${mine ? "rounded-[20px] rounded-br-[8px]" : "vo-soft rounded-[20px] rounded-bl-[8px]"} bg-surface`}
      style={{ width: size.width, height: size.height, maxWidth: "100%" }}
      data-testid={`chat-media-${media.kind || "image"}`}
      data-status={uploading ? "uploading" : status}
    >
      {media.kind === "video" ? (
        media.poster ? (
          <img src={mediaUrl(media.poster)} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : m.localUrl ? (
          <video src={m.localUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        ) : (
          <div className="h-full w-full bg-ink/80" />
        )
      ) : (
        <img src={m.localUrl || mediaUrl(media.url)} alt="" className="h-full w-full object-cover" draggable={false} />
      )}

      {/* overlays: uploading / processing / failed / play */}
      {uploading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 text-white" data-testid="chat-media-uploading">
          <div className="relative h-12 w-12">
            <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
              <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.25)" strokeWidth="3.5" fill="none" />
              <circle cx="24" cy="24" r="20" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeDasharray={`${Math.max(2, m.progress * 125.6)} 125.6`} />
            </svg>
          </div>
          <span className="mt-2 text-[12px] font-semibold">{Math.round(m.progress * 100)}%</span>
        </div>
      ) : status === "processing" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 text-white" data-testid="chat-media-processing">
          <Spinner size={26} stroke={2.5} className="text-white" />
          <span className="mt-2 text-[12px] font-semibold">Processing...</span>
        </div>
      ) : status === "failed" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 px-4 text-center text-white" data-testid="chat-media-failed">
          <span className="text-[13px] font-semibold">Couldn't process this video</span>
          {mine && onRetry && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">
              <RefreshCw className="h-3.5 w-3.5" /> Send again
            </span>
          )}
        </div>
      ) : media.kind === "video" ? (
        <>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white">
              <Play className="ml-0.5 h-5 w-5" fill="currentColor" strokeWidth={0} />
            </span>
          </span>
          {media.duration ? <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">{formatDuration(media.duration)}</span> : null}
        </>
      ) : null}
    </button>
  );
};

/** View-once message: a compact pill, never shows the content inline. */
export const ViewOnceBubble = ({ m, mine, onOpen, busy }) => {
  const media = m.media || {};
  const opened = !!media.opened_at || media.status === "expired";
  const isVideo = media.kind === "video";
  const Icon = isVideo ? Film : ImageIcon;
  const label = isVideo ? "Video" : "Photo";
  const uploading = m.pending && typeof m.progress === "number";
  const processing = media.status === "processing";
  const disabled = mine || opened || uploading || processing || busy;
  const sub = uploading
    ? `Uploading ${Math.round(m.progress * 100)}%`
    : processing
      ? "Processing..."
      : opened
        ? "Opened"
        : mine
          ? "View once - not opened yet"
          : "Tap to view once";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onOpen(m)}
      className={`flex items-center gap-3 px-3.5 py-3 text-left focus-visible:outline-none ${mine ? "rounded-[20px] rounded-br-[8px] bg-ink text-onink" : "vo-soft rounded-[20px] rounded-bl-[8px] text-ink"} ${!disabled ? "active:opacity-80" : ""}`}
      data-testid="chat-media-view-once"
      data-opened={opened ? "true" : "false"}
    >
      <span className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full ${mine ? "bg-white/15" : "vo-soft-sunken"} ${opened ? "opacity-50" : ""}`}>
        {busy ? <Spinner size={18} stroke={2.4} /> : opened ? <Clock className="h-[18px] w-[18px]" strokeWidth={2} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={2} />}
      </span>
      <span className="min-w-0">
        <span className={`block text-[15px] font-semibold leading-[19px] ${opened ? "opacity-60" : ""}`}>
          <Icon className="mr-1 inline h-4 w-4 -translate-y-px" strokeWidth={2} />
          {label}
        </span>
        <span className={`block text-[12.5px] leading-[16px] ${mine ? "text-onink/70" : "text-mute"}`}>{sub}</span>
      </span>
    </button>
  );
};
