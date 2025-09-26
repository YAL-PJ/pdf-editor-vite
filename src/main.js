/**
 * main.js
 * - Slim orchestrator: init prefs → apply, bootstrap UI, global listeners, persistence lifecycle
 */

import { updateRenderConfig } from "@ui/overlay/config.js";
import { bootstrapUI } from "@app/bootstrap";
import { attachGlobalListeners } from "@app/listeners";

import { openFile, handlers, restoreFile, rerender } from "@app/controller";
import { loadState, initUnloadWarning, scheduleSave, saveStateSync } from "@app/persistence";
import { historyInit } from "@app/history";
import { state } from "@app/state";

import {
  initFromStorage as initRenderPrefs,
  getPrefs as getRenderPrefs,
  toggleGuides,
  cycleEdge,
  getGuidesEnabled,
  getEdgePx,
} from "@app/renderPrefs";
import { makeSaveName, extractOriginalName } from "@app/filename";
import { initFitObserver } from "@app/fitObserver";
import { setPannable } from "@ui/overlay";

// DEV-ONLY: layout shift logger
if (import.meta?.env?.DEV) {
  import("./dev/layoutShiftDebug.js").then((m) => m.installLayoutShiftLogger());
}

/* ---------- Constants & safe storage ---------- */
export const LS_KEYS = { lastName: "last_pdf_name" };

// Dev-only, once-per (op,key) storage warnings
const _storageWarned = new Set();
function _warnStorage(op, key, err) {
  if (!import.meta?.env?.DEV) return;
  const tag = `${op}:${key}`;
  if (_storageWarned.has(tag)) return;
  _storageWarned.add(tag);
  console.warn(`[storage] ${op} failed for "${key}"`, err);
}

function safeSet(key, value) {
  try { localStorage.setItem(key, value); }
  catch (e) { _warnStorage("setItem", key, e); }
}

function safeGet(key) {
  try { return localStorage.getItem(key); }
  catch (e) { _warnStorage("getItem", key, e); return null; }
}

/* ---------- Adaptive autosave delay (optional) ---------- */
function chooseAutosaveDelay() {
  const forced = Number(safeGet?.("autosave_ms"));
  if (Number.isFinite(forced) && forced >= 0) return forced;

  const cores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;
  const mem = (typeof navigator !== "undefined" && navigator.deviceMemory) || 4;
  const prefersReducedMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  let ms = 50; // baseline
  if (cores <= 4 || mem <= 4 || prefersReducedMotion) ms = 120;
  if (cores <= 2 || mem <= 2) ms = 180;
  return ms;
}

export const AUTOSAVE_DELAY_MS = Math.max(40, Math.min(240, chooseAutosaveDelay()));

/* ---------- Initialize render prefs (runtime) ---------- */
updateRenderConfig(initRenderPrefs());

/* ---------- DEV mirrors (live getters, namespaced) ---------- */
const DEV_MIRROR = !!import.meta?.env?.DEV;
if (DEV_MIRROR && typeof window !== "undefined") {
  const dbg = (window.__appDebug ||= {});

  Object.defineProperties(dbg, {
    snapGuidesEnabled: { get: getGuidesEnabled, enumerable: true },
    snapEdgePx:        { get: getEdgePx,        enumerable: true },
    renderPrefs:       { get: () => ({ ...getRenderPrefs() }), enumerable: true },
  });

  dbg.print = () => console.table(dbg.renderPrefs);
  dbg.toggleGuides = () => toggleGuides();
  dbg.cycleEdge    = () => cycleEdge();
  // console.info("[dev] Debug mirrors at window.__appDebug");
}

/* ---------- Bootstrap UI (toolbar, overlay tools, file input) ---------- */
const { toolbarHandlers } = bootstrapUI({
  handlers,
  openFile,
  extractOriginalName,
  autosaveDelayMs: AUTOSAVE_DELAY_MS,
  lsKeys: LS_KEYS,
});

// Default tool is select (null) → enable drag-to-pan affordance
try { setPannable(true); } catch {}

/* ---------- Refit PDF when viewer container resizes ---------- */
initFitObserver(
  () => document.querySelector(".viewer-scroll") || document.getElementById("viewer"),
  rerender
);

/* ---------- Global listeners (HMR-safe) ---------- */
const resolveLoadedPdf = () => {
  if (!state.loadedPdfData) {
    alert("Open a PDF first.");
    return null;
  }
  return state.loadedPdfData;
};

const resolveFileName = () => {
  const orig = state.originalFileName || safeGet(LS_KEYS.lastName);
  return makeSaveName(orig);
};

attachGlobalListeners({
  onRequestImage: () => toolbarHandlers.onPickImage?.(),
  onDownloadRequested: async () => {
    const data = resolveLoadedPdf();
    if (!data) return;
    const saveAs = resolveFileName();
    const { downloadAnnotatedPdf } = await import("@pdf/exportAnnotated");
    downloadAnnotatedPdf(data, saveAs);
  },
  onPrintRequested: async () => {
    const data = resolveLoadedPdf();
    if (!data) return;
    const { printAnnotatedPdf } = await import("@pdf/exportAnnotated");
    await printAnnotatedPdf(data);
  },
  onShareRequested: async () => {
    const data = resolveLoadedPdf();
    if (!data) return;
    const saveAs = resolveFileName();
    const { shareAnnotatedPdf } = await import("@pdf/exportAnnotated");
    await shareAnnotatedPdf(data, saveAs);
  },
  onSaveLocalRequested: async () => {
    await saveStateSync();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("annotator:notify", {
          detail: {
            level: "info",
            message: "Annotations saved locally.",
          },
        })
      );
    }
    console.info("[app] Annotations saved locally.");
  },
  updateRenderConfig,
  getRenderPrefs,
  toggleGuides,
  cycleEdge,
  getGuidesEnabled,
  getEdgePx,
  devMirror: DEV_MIRROR,
});

/* ---------- Restore + lifecycle ---------- */
const wasStateRestored = await loadState();
if (wasStateRestored) {
  try {
    const last = safeGet(LS_KEYS.lastName);
    if (last) state.originalFileName = last;
    restoreFile();
    scheduleSave(AUTOSAVE_DELAY_MS);
  } catch (e) { console.error("Restore failed", e); }
}
initUnloadWarning();

/* ---------- Start history baseline ---------- */
historyInit();
