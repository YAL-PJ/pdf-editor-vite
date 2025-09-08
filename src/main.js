/**
 * main.js
 * - Slim orchestrator: init prefs → apply, bootstrap UI, global listeners, persistence lifecycle
 */
// import "./style.css"; // ❌ not needed; CSS loaded via <link> in index.html

import { updateRenderConfig } from "@ui/overlay/config.js";
import { bootstrapUI } from "@app/bootstrap";
import { attachGlobalListeners } from "@app/listeners";

import { openFile, handlers, restoreFile, rerender } from "@app/controller";
import { loadState, initUnloadWarning, scheduleSave } from "@app/persistence";
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
import { downloadAnnotatedPdf } from "./pdf/exportAnnotated.js";
import { initFitObserver } from "@app/fitObserver";

// DEV-ONLY: layout shift logger
if (import.meta?.env?.DEV) {
  import("./dev/layoutShiftDebug.js").then((m) => m.installLayoutShiftLogger());
}

/* ---------- Constants & safe storage ---------- */
export const LS_KEYS = { lastName: "last_pdf_name" };
export const AUTOSAVE_DELAY_MS = 50;

function safeSet(key, value) { try { localStorage.setItem(key, value); } catch {} }
function safeGet(key)        { try { return localStorage.getItem(key); } catch { return null; } }

/* ---------- Initialize render prefs (runtime) ---------- */
updateRenderConfig(initRenderPrefs());

/* ---------- DEV mirrors ---------- */
const DEV_MIRROR = !!import.meta?.env?.DEV;
if (DEV_MIRROR) {
  window.__snapGuidesEnabled = getGuidesEnabled();
  window.__snapEdgePx = getEdgePx();
  window.__renderPrefs = () => ({ ...getRenderPrefs() });
}

/* ---------- Bootstrap UI (toolbar, overlay tools, file input) ---------- */
const { toolbarHandlers } = bootstrapUI({
  handlers,
  openFile,
  extractOriginalName,
  autosaveDelayMs: AUTOSAVE_DELAY_MS,
  lsKeys: LS_KEYS,
});

/* ---------- Refit PDF when viewer container resizes ---------- */
initFitObserver(
  () => document.querySelector(".viewer-scroll") || document.getElementById("viewer"),
  rerender
);

/* ---------- Global listeners (HMR-safe) ---------- */
attachGlobalListeners({
  onRequestImage: () => toolbarHandlers.onPickImage?.(),
  onDownloadRequested: async () => {
    if (!state.loadedPdfData) { alert("Open a PDF first."); return; }
    const orig = state.originalFileName || safeGet(LS_KEYS.lastName);
    const saveAs = makeSaveName(orig);
    downloadAnnotatedPdf(state.loadedPdfData, saveAs);
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
