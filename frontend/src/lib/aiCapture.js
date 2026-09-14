import html2canvas from "html2canvas";
import { nativeCapture } from "@/lib/native";

/*
 * Orb visual search - capture what the user circled.
 *  captureRegion(bbox)  -> { image (JPEG data URL of the marked area, ink included), region }
 *  collectContext(bbox) -> { texts[], user_ids[], post_ids[], route } - what the DOM says is under the stroke,
 *                          so the model can read names / captions even when the pixels are small.
 * In the Android shell the picture comes from the native PixelCopy bridge (exact pixels, videos included);
 * in a browser html2canvas re-renders the page.
 */
const PAD = 34;
const MIN = 200;
const MAX_OUT = 1024;

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const expand = (bbox) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = bbox.x - PAD;
  let y = bbox.y - PAD;
  let w = bbox.w + PAD * 2;
  let h = bbox.h + PAD * 2;
  if (w < MIN) {
    x -= (MIN - w) / 2;
    w = MIN;
  }
  if (h < MIN) {
    y -= (MIN - h) / 2;
    h = MIN;
  }
  x = Math.max(0, Math.min(x, vw - 1));
  y = Math.max(0, Math.min(y, vh - 1));
  w = Math.min(w, vw - x);
  h = Math.min(h, vh - y);
  return { x, y, w, h };
};

const crop = (source, sw, sh, region) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sx = sw / vw;
  const sy = sh / vh;
  const scale = Math.min(1, MAX_OUT / Math.max(region.w * sx, region.h * sy));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(region.w * sx * scale));
  out.height = Math.max(1, Math.round(region.h * sy * scale));
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, region.x * sx, region.y * sy, region.w * sx, region.h * sy, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.84);
};

export const captureRegion = async (bbox) => {
  const region = expand(bbox);
  const nativeShot = await nativeCapture();
  if (nativeShot) {
    const img = await loadImage(nativeShot);
    return { image: crop(img, img.naturalWidth, img.naturalHeight, region), region };
  }
  const canvas = await html2canvas(document.body, {
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: null,
    scale: Math.min(window.devicePixelRatio || 1, 2),
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    ignoreElements: (el) => el.classList?.contains("vo-orb") || el.hasAttribute?.("data-ai-ignore"),
  });
  return { image: crop(canvas, canvas.width, canvas.height, region), region };
};

/*
 * The stroke always starts at the tab bar (the orb is carried up from there), so the raw bbox would include the whole
 * carry line. Keep only the marking: the closed loop if the user circled something, otherwise everything after the
 * first real change of direction from the initial carry.
 */
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const bboxOf = (pts) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

export const markedBBox = (points, fallback) => {
  if (!points || points.length < 6) return fallback || (points?.length ? bboxOf(points) : null);
  const end = points[points.length - 1];
  // 1) closed loop: earliest point that comes back within reach of where the finger lifted
  for (let i = 0; i < points.length - 8; i++) {
    if (dist(points[i], end) < 40) {
      const loop = points.slice(i);
      const b = bboxOf(loop);
      if (b.w + b.h > 40) return b;
      break;
    }
  }
  // 2) open stroke: drop the initial carry (first segment heading steadily in one direction)
  let k = 1;
  while (k < points.length - 1 && dist(points[0], points[k]) < 40) k++;
  const dir = [points[k][0] - points[0][0], points[k][1] - points[0][1]];
  const dl = Math.hypot(dir[0], dir[1]) || 1;
  let cut = -1;
  for (let j = k; j < points.length - 3; j++) {
    const a = points[j];
    const b = points[Math.min(points.length - 1, j + 3)];
    const v = [b[0] - a[0], b[1] - a[1]];
    const vl = Math.hypot(v[0], v[1]) || 1;
    const cos = (v[0] * dir[0] + v[1] * dir[1]) / (vl * dl);
    if (cos < 0.35) {
      cut = j;
      break;
    }
  }
  if (cut > 0) {
    const rest = points.slice(cut);
    const b = bboxOf(rest);
    if (b.w + b.h > 30) return b;
  }
  return fallback || bboxOf(points);
};

const intersects = (r, b) => r.width > 0 && r.height > 0 && r.right >= b.x && r.left <= b.x + b.w && r.bottom >= b.y && r.top <= b.y + b.h;

export const collectContext = (bbox) => {
  const b = expand(bbox);
  const root = document.getElementById("vo-main") || document.body;
  const texts = [];
  const seen = new Set();
  const user_ids = new Set();
  const post_ids = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node && texts.length < 40) {
    const t = (node.nodeValue || "").replace(/\s+/g, " ").trim();
    if (t.length >= 2) {
      const el = node.parentElement;
      if (el && !el.closest("[data-ai-ignore], nav, script, style")) {
        const r = el.getBoundingClientRect();
        if (intersects(r, b) && !seen.has(t)) {
          seen.add(t);
          texts.push(t.slice(0, 160));
        }
      }
    }
    node = walker.nextNode();
  }
  root.querySelectorAll("[data-user-id]").forEach((el) => {
    if (intersects(el.getBoundingClientRect(), b)) user_ids.add(el.getAttribute("data-user-id"));
  });
  root.querySelectorAll("[data-post-id]").forEach((el) => {
    if (intersects(el.getBoundingClientRect(), b)) post_ids.add(el.getAttribute("data-post-id"));
  });
  return { texts, user_ids: [...user_ids].filter(Boolean).slice(0, 6), post_ids: [...post_ids].filter(Boolean).slice(0, 4), route: window.location.pathname };
};
