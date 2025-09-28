/**
 * zoomWheel.js
 * Normalizes trackpad pinch / Ctrl + mouse wheel zoom events to match toolbar zoom.
 */

import { handlers } from "@app/controller";

const MIN_DELTA = 0.05;

let installed = false;

function computeSteps(deltaY) {
  const abs = Math.abs(deltaY);
  if (!Number.isFinite(abs) || abs === 0) return 0;
  // Translate wheel delta into whole-number zoom steps, keeping behaviour aligned with toolbar buttons.
  return Math.max(1, Math.round(abs / 120));
}

export function initWheelZoom() {
  if (installed || typeof window === "undefined") return () => {};

  const onWheel = async (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    if (event.defaultPrevented) return;

    const delta = event.deltaY;
    if (!Number.isFinite(delta) || Math.abs(delta) < MIN_DELTA) return;

    event.preventDefault();

    const steps = computeSteps(delta);
    try {
      const fn = delta < 0 ? handlers.onZoomIn : handlers.onZoomOut;
      if (!fn) return;
      for (let i = 0; i < steps; i += 1) {
        await fn();
      }
    } catch (err) {
      console.error("[zoom] wheel zoom failed", err);
    }
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  installed = true;

  const cleanup = () => {
    window.removeEventListener("wheel", onWheel);
    installed = false;
  };

  if (import.meta?.hot) {
    import.meta.hot.dispose(cleanup);
  }

  return cleanup;
}
