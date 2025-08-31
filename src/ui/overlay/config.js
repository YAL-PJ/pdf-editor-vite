// src/ui/overlay/config.js
import { saveState } from "@app/persistence";

/** Public config (tweak at runtime) */
export const renderConfig = {
  snapEdgePx: 8,
  gridPx: 16,
  minTextW: 60,
  minTextH: 32,
  snapToGuides: true,
};
export function updateRenderConfig(patch = {}) {
  Object.assign(renderConfig, patch);
}

/** Small utils used across overlay modules */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const rafThrottle = (fn) => {
  let id = 0, args = null;
  return (...a) => { args = a; if (id) return; id = requestAnimationFrame(() => { id = 0; fn(...args); }); };
};
export const snapEdge = (val, max, thr) =>
  (Math.abs(val) <= thr ? 0 : Math.abs(max - val) <= thr ? max : val);
export const snapGrid = (val, grid) => Math.round(val / grid) * grid;

/** Debounced save (shared) */
export const scheduleSave = (() => {
  let t;
  return (immediate = false) => {
    clearTimeout(t);
    if (immediate) return saveState();
    t = setTimeout(() => saveState(), 250);
  };
})();

/** Flush on tab close */
window.addEventListener("beforeunload", () => scheduleSave(true));
