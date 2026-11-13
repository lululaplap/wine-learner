// Everything saved on the device goes through here. localStorage can be missing or full (private browsing,
// blocked site data); then nothing is saved and the tool still works for this visit.
const PREFIX = "apricity-wine:";

function safe(fn, fallback) {
  try { return fn(); } catch (e) { return fallback; }
}

export const store = {
  available: safe(() => { localStorage.setItem(PREFIX + "test", "1"); localStorage.removeItem(PREFIX + "test"); return true; }, false),
  get(key, fallback = null) {
    return safe(() => { const v = localStorage.getItem(PREFIX + key); return v == null ? fallback : JSON.parse(v); }, fallback);
  },
  set(key, value) {
    return safe(() => { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }, false);
  },
  remove(key) {
    safe(() => localStorage.removeItem(PREFIX + key));
  },
  // "Reset my progress" clears what a person did on this device, but keeps the saved sheets for offline use.
  resetProgress() {
    safe(() => Object.keys(localStorage).filter(k => k.startsWith(PREFIX) && !k.startsWith(PREFIX + "sheet:"))
      .forEach(k => localStorage.removeItem(k)));
  }
};
