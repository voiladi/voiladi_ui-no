/*
 * In-app feedback, Instagram/iOS style. No toast cards.
 *
 *  notice(text)   -> one thin glass bar pinned above the tab bar. Reserved for errors and things the user
 *                    MUST be told (e.g. "You've used all Super Likes"). Successful actions never call this:
 *                    they show up inline (row disappears, pill changes, sheet shows a done state).
 *  banner({...})  -> iOS-style notification banner at the top for realtime events (new match / message).
 *
 * A tiny module-level store; <FeedbackLayer/> (components/Feedback.jsx) renders whatever is queued.
 */

const listeners = new Set();
let state = { notice: null, banner: null };
let seq = 0;
let noticeTimer = null;
let bannerTimer = null;

const emit = () => listeners.forEach((l) => l(state));

export const subscribeFeedback = (fn) => {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
};

export const notice = (text, { duration = 2400 } = {}) => {
  if (!text) return;
  clearTimeout(noticeTimer);
  state = { ...state, notice: { id: ++seq, text: String(text) } };
  emit();
  noticeTimer = setTimeout(() => {
    state = { ...state, notice: null };
    emit();
  }, duration);
};

export const dismissNotice = () => {
  clearTimeout(noticeTimer);
  state = { ...state, notice: null };
  emit();
};

export const banner = ({ title, sub, photo, name, onClick, duration = 4500, testId = "banner" }) => {
  clearTimeout(bannerTimer);
  state = { ...state, banner: { id: ++seq, title, sub, photo, name, onClick, testId } };
  emit();
  bannerTimer = setTimeout(() => {
    state = { ...state, banner: null };
    emit();
  }, duration);
};

export const dismissBanner = () => {
  clearTimeout(bannerTimer);
  state = { ...state, banner: null };
  emit();
};

/* Dev/test hook only (not in production builds): window.__voFeedback.notice("...") / .banner({...}) */
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  window.__voFeedback = { notice, banner };
}
