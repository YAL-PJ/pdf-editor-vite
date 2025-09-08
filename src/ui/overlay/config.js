// NOTE: This module is intentionally PURE (runtime config only).
// ❗ Do NOT add persistence (localStorage/IDB) or lifecycle hooks here.
// ❗ Do NOT touch globals like window.__... here.
import { DEFAULT_RENDER_CONFIG } from '@config/defaults';

/** Public config (tweak at runtime) */
export const renderConfig = { ...DEFAULT_RENDER_CONFIG };

export function updateRenderConfig(patch = {}) {
  Object.assign(renderConfig, patch); // shallow merge into shared object
}

/** Small utils used across overlay modules */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const rafThrottle = (fn) => {
  let id = 0, args = null;
  return (...a) => {
    args = a;
    if (id) return;
    id = requestAnimationFrame(() => { id = 0; fn(...args); });
  };
};

export const snapEdge = (val, max, thr) =>
  (Math.abs(val) <= thr ? 0 : Math.abs(max - val) <= thr ? max : val);

export const snapGrid = (val, grid) => Math.round(val / grid) * grid;
