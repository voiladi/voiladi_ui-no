/*
 * Client-side photo editing for New post (Instagram style): crop / zoom / pan, filter presets and adjust sliders.
 * Everything is previewed with CSS (transform + filter) and baked into a JPEG with <canvas> right before upload,
 * so the server receives exactly what the user saw.
 *
 * Crop state is container-independent:
 *   { aspect: number | null, zoom: 1..MAX_ZOOM, nx: -1..1, ny: -1..1 }
 *   aspect null = the photo's own ratio ("Original"); nx / ny = pan as a fraction of the available overflow.
 */

export const MAX_ZOOM = 3;
export const EXPORT_MAX_SIDE = 1440;

export const ASPECTS = [
  { id: "original", label: "Original", value: null },
  { id: "square", label: "1:1", value: 1 },
  { id: "portrait", label: "4:5", value: 4 / 5 },
  { id: "landscape", label: "16:9", value: 16 / 9 },
];

export const DEFAULT_CROP = { aspect: 1, zoom: 1, nx: 0, ny: 0 };

/* Filter presets: CSS filter strings, tuned to feel like the Instagram classics. */
export const FILTERS = [
  { id: "normal", name: "Normal", css: "" },
  { id: "clarendon", name: "Clarendon", css: "contrast(1.2) saturate(1.35)" },
  { id: "gingham", name: "Gingham", css: "brightness(1.05) hue-rotate(-10deg) contrast(0.9)" },
  { id: "moon", name: "Moon", css: "grayscale(1) contrast(1.1) brightness(1.1)" },
  { id: "lark", name: "Lark", css: "contrast(0.9) brightness(1.1) saturate(1.1)" },
  { id: "reyes", name: "Reyes", css: "sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)" },
  { id: "juno", name: "Juno", css: "contrast(1.1) saturate(1.4) sepia(0.15)" },
  { id: "slumber", name: "Slumber", css: "saturate(0.66) brightness(1.05) sepia(0.2)" },
  { id: "crema", name: "Crema", css: "sepia(0.3) contrast(0.9) brightness(1.05) saturate(0.9)" },
  { id: "ludwig", name: "Ludwig", css: "brightness(1.05) contrast(1.05) saturate(0.85) sepia(0.1)" },
  { id: "aden", name: "Aden", css: "hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)" },
  { id: "perpetua", name: "Perpetua", css: "contrast(1.1) brightness(1.05) saturate(1.1) hue-rotate(10deg)" },
  { id: "valencia", name: "Valencia", css: "contrast(1.08) brightness(1.08) sepia(0.08)" },
  { id: "xpro", name: "X-Pro II", css: "sepia(0.3) contrast(1.3) saturate(1.5) brightness(0.95)" },
  { id: "willow", name: "Willow", css: "grayscale(0.5) contrast(0.95) brightness(0.9)" },
  { id: "inkwell", name: "Inkwell", css: "grayscale(1) sepia(0.3) contrast(1.1) brightness(1.1)" },
];

/* Adjust sliders: -100..100 except fade / vignette (0..100). */
export const ADJUSTMENTS = [
  { key: "brightness", label: "Brightness", min: -100, max: 100 },
  { key: "contrast", label: "Contrast", min: -100, max: 100 },
  { key: "saturation", label: "Saturation", min: -100, max: 100 },
  { key: "warmth", label: "Warmth", min: -100, max: 100 },
  { key: "fade", label: "Fade", min: 0, max: 100 },
  { key: "vignette", label: "Vignette", min: 0, max: 100 },
];

export const DEFAULT_ADJUST = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, fade: 0, vignette: 0 };

export const filterById = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];

/** The CSS `filter` for a preset + adjustments (used for the live preview and for canvas export). */
export const cssFilter = (filterId = "normal", adjust = DEFAULT_ADJUST) => {
  const parts = [];
  const preset = filterById(filterId).css;
  if (preset) parts.push(preset);
  const a = { ...DEFAULT_ADJUST, ...(adjust || {}) };
  if (a.brightness) parts.push(`brightness(${(1 + a.brightness / 200).toFixed(3)})`);
  if (a.contrast) parts.push(`contrast(${(1 + a.contrast / 200).toFixed(3)})`);
  if (a.saturation) parts.push(`saturate(${Math.max(0, 1 + a.saturation / 100).toFixed(3)})`);
  if (a.warmth > 0) parts.push(`sepia(${(a.warmth / 250).toFixed(3)})`);
  if (a.warmth < 0) parts.push(`hue-rotate(${(a.warmth / 100) * 18}deg) saturate(${(1 + a.warmth / 400).toFixed(3)})`);
  if (a.fade) parts.push(`contrast(${(1 - a.fade / 250).toFixed(3)}) brightness(${(1 + a.fade / 400).toFixed(3)})`);
  return parts.join(" ");
};

export const isUnedited = ({ crop, filterId, adjust, iw, ih } = {}) => {
  const c = { ...DEFAULT_CROP, ...(crop || {}) };
  const a = { ...DEFAULT_ADJUST, ...(adjust || {}) };
  const untouchedCrop = c.zoom === 1 && (c.aspect === null || (iw && ih && Math.abs(c.aspect - iw / ih) < 0.002));
  return untouchedCrop && (filterId || "normal") === "normal" && Object.keys(a).every((k) => !a[k]);
};

/**
 * Layout maths shared by the on-screen crop view and the export.
 * Given the box (W x H) the photo must cover and the photo's natural size, return the displayed size and offset.
 */
export const layoutCrop = (crop, iw, ih, W, H) => {
  const c = { ...DEFAULT_CROP, ...(crop || {}) };
  const s0 = Math.max(W / iw, H / ih); // cover
  const s = s0 * Math.min(MAX_ZOOM, Math.max(1, c.zoom || 1));
  const dw = iw * s;
  const dh = ih * s;
  const ox = ((dw - W) / 2) * clamp(c.nx, -1, 1);
  const oy = ((dh - H) / 2) * clamp(c.ny, -1, 1);
  return { s, dw, dh, ox, oy, left: (W - dw) / 2 + ox, top: (H - dh) / 2 + oy };
};

/** Source rectangle (in photo pixels) the crop state describes. */
export const cropRect = (crop, iw, ih) => {
  const c = { ...DEFAULT_CROP, ...(crop || {}) };
  const aspect = c.aspect || iw / ih;
  const W = 1000;
  const H = W / aspect;
  const { s, dw, dh, ox, oy } = layoutCrop(c, iw, ih, W, H);
  const sx = (dw / 2 - ox - W / 2) / s;
  const sy = (dh / 2 - oy - H / 2) / s;
  const sw = W / s;
  const sh = H / s;
  return { sx: clamp(sx, 0, iw - sw), sy: clamp(sy, 0, ih - sh), sw: Math.min(sw, iw), sh: Math.min(sh, ih) };
};

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));

/** Load a File / URL into an <img> (browsers honour EXIF orientation when drawing it). */
export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => {
      if (typeof src !== "string") URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (typeof src !== "string") URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that photo"));
    };
    img.src = url;
  });

/**
 * Bake crop + filter + adjustments into a JPEG File.
 * Returns the original file untouched when nothing was edited (keeps quality, saves work).
 */
export const exportEditedImage = async (file, { crop, filterId = "normal", adjust = DEFAULT_ADJUST } = {}, { maxSide = EXPORT_MAX_SIDE, quality = 0.92 } = {}) => {
  const img = await loadImage(file);
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (isUnedited({ crop, filterId, adjust, iw, ih }) && (file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp")) {
    return file;
  }
  const r = cropRect(crop, iw, ih);
  const scale = Math.min(1, maxSide / Math.max(r.sw, r.sh));
  const ow = Math.max(1, Math.round(r.sw * scale));
  const oh = Math.max(1, Math.round(r.sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = ow;
  canvas.height = oh;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ow, oh);
  const f = cssFilter(filterId, adjust);
  if (f && "filter" in ctx) ctx.filter = f;
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, ow, oh);
  ctx.filter = "none";
  const a = { ...DEFAULT_ADJUST, ...(adjust || {}) };
  if (a.fade > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(a.fade / 100) * 0.22})`;
    ctx.fillRect(0, 0, ow, oh);
  }
  if (a.vignette > 0) {
    const g = ctx.createRadialGradient(ow / 2, oh / 2, Math.min(ow, oh) * 0.35, ow / 2, oh / 2, Math.max(ow, oh) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${(a.vignette / 100) * 0.75})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ow, oh);
  }
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process that photo"))), "image/jpeg", quality));
  const base = (file.name || "photo").replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
};

/** Inline style for the vignette / fade overlays used by the live preview (mirrors the export). */
export const overlayStyle = (adjust = DEFAULT_ADJUST) => {
  const a = { ...DEFAULT_ADJUST, ...(adjust || {}) };
  const layers = [];
  if (a.vignette > 0) layers.push(`radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${((a.vignette / 100) * 0.75).toFixed(3)}) 100%)`);
  if (a.fade > 0) layers.push(`linear-gradient(rgba(255,255,255,${((a.fade / 100) * 0.22).toFixed(3)}), rgba(255,255,255,${((a.fade / 100) * 0.22).toFixed(3)}))`);
  return layers.length ? { backgroundImage: layers.join(", ") } : null;
};
