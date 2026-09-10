import { api, BACKEND_URL } from "@/lib/api";

/*
 * Chunked media upload for chat (photos + videos).
 * The CDN in front of the API caps request bodies, so files go up in <= 8MB pieces:
 *   init -> chunk x N -> complete (returns the chat message; videos keep processing server-side).
 * onProgress(0..1) is called as bytes land.
 */

export const MEDIA_MAX_VIDEO_SECONDS = 5 * 60;
export const MEDIA_MAX_VIDEO_BYTES = 600 * 1024 * 1024;
export const MEDIA_MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export const mediaUrl = (u) => (!u ? "" : u.startsWith("http") ? u : `${BACKEND_URL}${u}`);

export const isVideoFile = (file) => (file?.type || "").startsWith("video/");
export const isImageFile = (file) => (file?.type || "").startsWith("image/");

/** Duration (seconds) of a local video file, or null if the browser can't read it. */
export const probeVideoDuration = (file) =>
  new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      const done = (d) => {
        URL.revokeObjectURL(url);
        resolve(d);
      };
      v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null);
      v.onerror = () => done(null);
      v.src = url;
    } catch (e) {
      resolve(null);
    }
  });

export const formatDuration = (s) => {
  if (!s && s !== 0) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export const uploadChatMedia = async ({ file, matchId, viewOnce = false, clientId, duration, onProgress, signal }) => {
  const { data: init } = await api.post("/media/init", {
    match_id: matchId,
    content_type: file.type || (isVideoFile(file) ? "video/mp4" : "image/jpeg"),
    size: file.size,
    view_once: viewOnce,
    client_id: clientId,
    duration: duration || undefined,
  });
  const chunk = init.chunk_size || 8 * 1024 * 1024;
  const total = Math.ceil(file.size / chunk);
  let sent = 0;
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
    const blob = file.slice(i * chunk, Math.min(file.size, (i + 1) * chunk));
    // one retry per chunk on flaky mobile networks
    let attempt = 0;
    for (;;) {
      try {
        await api.put(`/media/${init.upload_id}/chunk`, blob, {
          params: { i },
          headers: { "Content-Type": "application/octet-stream" },
          timeout: 120000,
          signal,
          onUploadProgress: (e) => onProgress?.(Math.min(0.99, (sent + (e.loaded || 0)) / file.size)),
        });
        break;
      } catch (e) {
        if (e?.name === "CanceledError" || e?.name === "AbortError" || attempt >= 1 || e?.response?.status) throw e;
        attempt += 1;
      }
    }
    sent += blob.size;
    onProgress?.(Math.min(0.99, sent / file.size));
  }
  const { data } = await api.post(`/media/${init.upload_id}/complete`, null, { timeout: 120000 });
  onProgress?.(1);
  return data;
};
