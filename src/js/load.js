// Fetches each sheet fresh every time the tool opens. A good copy is saved on the device, so if a sheet
// cannot be loaded the tool shows the last saved copy, with its date and a "may be out of date" notice.
import { store } from "./store.js";

export async function loadSheet(name, url, fallbackUrl) {
  const saveKey = "sheet:" + name;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    const text = await res.text();
    if (/^\s*</.test(text)) throw new Error("not a CSV file"); // an unpublished sheet returns an HTML page
    const at = Date.now();
    store.set(saveKey, { text, at });
    return { name, text, at, fresh: true };
  } catch (err) {
    const saved = store.get(saveKey);
    if (saved && saved.text) return { name, text: saved.text, at: saved.at, fresh: false, error: String(err.message || err) };
    if (fallbackUrl && fallbackUrl !== url) {
      const res = await fetch(fallbackUrl).catch(() => null);
      if (res && res.ok) {
        // The copy that ships with the tool: its file date says when it was copied, not when the list was, so no time is shown.
        return { name, text: await res.text(), at: null, fresh: false, error: String(err.message || err), bundled: true };
      }
    }
    throw new Error("Could not load the " + name + " sheet (" + (err.message || err) + ") and there is no saved copy on this device.");
  }
}
