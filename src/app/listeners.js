// src/app/listeners.js
// Global listeners: keyboard shortcuts (guides/edge snap), ESC behavior,
// custom events (image/download), and HMR-safe attach/detach.
// DEV-ONLY mirrors to window are clearly marked and safe to delete in prod.

import { state } from "@app/state";

let bootstrapped = false;

/**
 * @param {{
 *   onRequestImage: () => void,
 *   onDownloadRequested: () => void | Promise<void>,
 *   onPrintRequested?: () => void | Promise<void>,
 *   onShareRequested?: () => void | Promise<void>,
 *   onSaveLocalRequested?: () => void | Promise<void>,
 *   updateRenderConfig: (patchOrConfig: object) => void,
 *   getRenderPrefs: () => object,
 *   toggleGuides: () => object,   // returns new prefs
 *   cycleEdge: () => object,      // returns new prefs
 *   getGuidesEnabled: () => boolean,
 *   getEdgePx: () => number,
 *   devMirror?: boolean           // if true, mirror to window.__* for dev/tests
 * }} deps
 */
export function attachGlobalListeners({
  onRequestImage,
  onDownloadRequested,
  onPrintRequested,
  onShareRequested,
  onSaveLocalRequested,
  updateRenderConfig,
  getRenderPrefs,
  toggleGuides,
  cycleEdge,
  getGuidesEnabled,
  getEdgePx,
  devMirror = false,
}) {
  if (bootstrapped) return;
  bootstrapped = true;

  function onShortcut(e) {
    const cmd = e.metaKey || e.ctrlKey;
    if (!cmd) return;
    const key = e.key.toLowerCase();

    if (key === "g") {
      e.preventDefault();
      toggleGuides();
      updateRenderConfig(getRenderPrefs());

      /** DEV-ONLY mirror for DevTools/e2e. ✅ Safe to delete in prod. */
      if (devMirror) {
        window.__snapGuidesEnabled = getGuidesEnabled();
      }
    } else if (key === "e") {
      e.preventDefault();
      cycleEdge();
      updateRenderConfig(getRenderPrefs());

      /** DEV-ONLY mirror for DevTools/e2e. ✅ Safe to delete in prod. */
      if (devMirror) {
        window.__snapEdgePx = getEdgePx();
      }
    }
  }

  function onEsc(e) {
    if (e.key !== "Escape") return;

    const active = document.activeElement;
    if (active?.closest?.(".note-body, .text-body")) {
      active.blur();
      return;
    }
    if (state.tool === "image") {
      const draggingPreview = document.querySelector(".image-box.preview");
      if (!draggingPreview) state.pendingImageSrc = null;
    }
  }

  function handleRequestImage() {
    onRequestImage?.();
  }

  async function handleDownloadRequested() {
    await onDownloadRequested?.();
  }

  async function handlePrintRequested() {
    await onPrintRequested?.();
  }

  async function handleShareRequested() {
    await onShareRequested?.();
  }

  async function handleSaveLocalRequested() {
    await onSaveLocalRequested?.();
  }

  window.addEventListener("keydown", onShortcut);
  document.addEventListener("keydown", onEsc);
  document.addEventListener("annotator:request-image", handleRequestImage);
  document.addEventListener("annotator:download-requested", handleDownloadRequested);
  document.addEventListener("annotator:print-requested", handlePrintRequested);
  document.addEventListener("annotator:share-requested", handleShareRequested);
  document.addEventListener("annotator:save-local-requested", handleSaveLocalRequested);

  if (import.meta?.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener("keydown", onShortcut);
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("annotator:request-image", handleRequestImage);
      document.removeEventListener("annotator:download-requested", handleDownloadRequested);
      document.removeEventListener("annotator:print-requested", handlePrintRequested);
      document.removeEventListener("annotator:share-requested", handleShareRequested);
      document.removeEventListener("annotator:save-local-requested", handleSaveLocalRequested);
      bootstrapped = false;
    });
  }
}
