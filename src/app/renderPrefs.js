import { DEFAULT_RENDER_PREFS } from '@config/defaults';
import { safeStorage } from '@app/safeStorage';
import { updateRenderConfig } from '@ui/overlay/config';

const LS_KEY = 'annotator_prefs';

/** In-memory state (start from defaults) */
let prefs = { ...DEFAULT_RENDER_PREFS };

/* ---------- Public API ---------- */
export function initFromStorage() {
  const stored = safeStorage.parse(safeStorage.get(LS_KEY), {});
  prefs = { ...DEFAULT_RENDER_PREFS, ...(stored && typeof stored === 'object' ? stored : {}) };
  return { ...prefs }; // copy-out
}

export function getPrefs() {
  return { ...prefs }; // copy-out
}

export function setPrefs(patch) {
  prefs = { ...prefs, ...(patch || {}) };
  safeStorage.set(LS_KEY, JSON.stringify(prefs));
  return { ...prefs }; // copy-out
}

/** Persist prefs and also apply to live runtime config */
export function applyAndSave(patch) {
  const next = setPrefs(patch);
  updateRenderConfig(next);
  return next;
}

export function toggleGuides() {
  return applyAndSave({ snapToGuides: !prefs.snapToGuides });
}

const EDGE_STEPS = [8, 12, 16, 4]; // clearer than modulo trick
export function cycleEdge() {
  const current = +prefs.snapEdgePx || DEFAULT_RENDER_PREFS.snapEdgePx;
  const idx = EDGE_STEPS.indexOf(current);
  const next = EDGE_STEPS[(idx >= 0 ? idx + 1 : 0) % EDGE_STEPS.length];
  return applyAndSave({ snapEdgePx: next });
}

export function getGuidesEnabled() {
  return !!prefs.snapToGuides;
}

export function getEdgePx() {
  const n = +prefs.snapEdgePx || DEFAULT_RENDER_PREFS.snapEdgePx;
  return Math.max(4, Math.min(32, n)); // clamp for safety
}
