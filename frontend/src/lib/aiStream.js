import { API, getToken } from "@/lib/api";

/*
 * Streamed orb lookup. POST /api/ai/lookup/stream answers NDJSON:
 *   {type:"delta", text}  ... {type:"done", title, kind, answer, terms, web_query, found, ...} | {type:"error", status, detail}
 * onDelta(fullTextSoFar) fires as words arrive; resolves with the "done" payload.
 * Errors are thrown shaped like axios errors ({response:{status,data:{detail}}}) so errMsg() works on them.
 */
const asAxiosError = (status, detail) => {
  const err = new Error(detail || "Request failed");
  err.response = { status, data: { detail } };
  return err;
};

export const streamLookup = async (payload, onDelta) => {
  const headers = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${API}/ai/lookup/stream`, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.detail;
    } catch (e) {
      detail = "";
    }
    throw asAxiosError(res.status, typeof detail === "string" ? detail : "");
  }
  let sofar = "";
  let done = null;
  const handle = (line) => {
    const s = line.trim();
    if (!s) return;
    let ev;
    try {
      ev = JSON.parse(s);
    } catch (e) {
      return;
    }
    if (ev.type === "delta") {
      sofar += ev.text || "";
      onDelta?.(sofar);
    } else if (ev.type === "done") {
      done = ev;
    } else if (ev.type === "error") {
      throw asAxiosError(ev.status || 400, ev.detail);
    }
  };
  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        handle(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    }
    if (buf.trim()) handle(buf);
  } else {
    // very old WebViews: no ReadableStream - read the whole body at once
    (await res.text()).split("\n").forEach(handle);
  }
  if (!done) throw asAxiosError(502, "Your AI didn't answer. Try again");
  return done;
};

/* Client-side mirror of the server parser so the header can render while the text is still arriving. */
export const parseLive = (raw) => {
  let title = "";
  let kind = "";
  const kept = [];
  (raw || "").split("\n").forEach((ln) => {
    const m = ln.trim().replace(/^\*+|\*+$/g, "").match(/^(title|kind|terms)\s*:\s*(.*)$/i);
    if (!m) {
      kept.push(ln);
      return;
    }
    const key = m[1].toLowerCase();
    if (key === "title" && !title) title = m[2].trim();
    else if (key === "kind" && !kind) kind = m[2].trim().toLowerCase();
  });
  // a line that's still being typed ("TIT", "TITLE: Ni") shouldn't flash as body text
  const text = kept.join("\n").replace(/(^|\n)\s*(t(i(t(l(e)?)?)?)?|k(i(n(d)?)?)?|t(e(r(m(s)?)?)?)?)\s*:?\s*$/i, "").trim();
  return { title, kind, text };
};

export const KIND_LABEL = {
  product: "Product", fashion: "Fashion", person: "Person", place: "Place", food: "Food", animal: "Animal", plant: "Plant",
  vehicle: "Vehicle", text: "Text", art: "Art", app: "App", other: "",
};

export const webSearchUrl = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
