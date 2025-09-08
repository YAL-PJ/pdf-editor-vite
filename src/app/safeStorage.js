// Centralized, defensive access to localStorage + JSON
export const safeStorage = {
  get(key) {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  },
  set(key, value) {
    try { globalThis.localStorage?.setItem(key, value); } catch {}
  },
  parse(json, fallback) {
    try { return JSON.parse(json); } catch { return fallback; }
  },
};
