/**
 * main.js
 * - Slim orchestrator: init prefs → apply, bootstrap UI, global listeners, persistence lifecycle
 */
import "./style.css";

import { updateRenderConfig } from "@ui/overlay/render.js";
import { bootstrapUI } from "@app/bootstrap";
import { attachGlobalListeners } from "@app/listeners";

import { createToolbar } from "@ui/toolbar";            // (kept by bootstrap internally; not used here)
import { initTextDrag, initImageDrag } from "@ui/overlay"; // (kept by bootstrap internally; not used here)

import { openFile, handlers, restoreFile } from "@app/controller";
import { loadState, initUnloadWarning, scheduleSave } from "@app/persistence";
import { historyInit } from "@app/history";
import { state } from "@app/state";

import {
  initFromStorage as initRenderPrefs,
  getPrefs as getRenderPrefs,
  toggleGuides, cycleEdge, getGuidesEnabled, getEdgePx,
} from "@app/renderPrefs";
import { makeSaveName, extractOriginalName } from "@app/filename";
import { downloadAnnotatedPdf } from "./pdf/exportAnnotated.js";

/* ---------- Constants & safe storage ---------- */
export const LS_KEYS = { lastName: "last_pdf_name" };
export const AUTOSAVE_DELAY_MS = 50;

function safeSet(key, value) { try { localStorage.setItem(key, value); } catch {} }
function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }

/* ---------- Initialize render prefs (runtime) ---------- */
updateRenderConfig(initRenderPrefs());

/**
 * DEV-ONLY mirrors for DevTools + e2e tests.
 * ✅ SAFE TO DELETE IN PROD (not required at runtime).
 */
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
  devMirror: DEV_MIRROR, // DEV-ONLY mirrors to window; ✅ Safe to set false or remove in prod.
});

/* ---------- Restore + lifecycle ---------- */
const wasStateRestored = await loadState();
if (wasStateRestored) {
  try {
    const last = safeGet(LS_KEYS.lastName);
    if (last) state.originalFileName = last;
    restoreFile();
    scheduleSave(AUTOSAVE_DELAY_MS);
  } catch (e) {
    console.error("Restore failed", e);
  }
}
initUnloadWarning();

/* ---------- Start history baseline ---------- */
historyInit();
