// src/app/renderPrefs.js
const LS_KEY = "annotator_prefs";

// In-memory defaults
let prefs = {
  snapToGuides: true,
  snapEdgePx: 8,
};

/* ---------- Safe storage ---------- */
function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}
function safeGet(key) {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
function safeSet(key, value) {
  try { globalThis.localStorage?.setItem(key, value); } catch {}
}

/* ---------- Public API ---------- */
export function initFromStorage() {
  const stored = safeParse(safeGet(LS_KEY), {});
  prefs = { ...prefs, ...(stored && typeof stored === "object" ? stored : {}) };
  return { ...prefs };
}

export function getPrefs() {
  return { ...prefs };
}

export function setPrefs(patch) {
  prefs = { ...prefs, ...(patch || {}) };
  safeSet(LS_KEY, JSON.stringify(prefs));
  return { ...prefs };
}

export function toggleGuides() {
  return setPrefs({ snapToGuides: !prefs.snapToGuides });
}

export function cycleEdge() {
  const next = ((prefs.snapEdgePx ?? 8) % 16) + 4; // 8→12→16→4...
  return setPrefs({ snapEdgePx: next });
}

export function getGuidesEnabled() {
  return !!prefs.snapToGuides;
}

export function getEdgePx() {
  return +prefs.snapEdgePx || 8;
}
