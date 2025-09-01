/**
 * main.js
 * - Bootstraps UI + persistence
 * - Autosave & history for state-changing handlers
 * - HMR-safe listeners + render prefs module + decoupled download
 */
import { createToolbar } from "@ui/toolbar";
import { setupFileInput } from "@ui/uiHandlers";
import { openFile, handlers, restoreFile } from "@app/controller";
import { state } from "@app/state";
import { initHighlightDrag, initNotePlacement, initTextDrag, initImageDrag } from "@ui/overlay";
import { updateRenderConfig } from "@ui/overlay/render.js";
import { downloadAnnotatedPdf } from "./pdf/exportAnnotated.js";
import { loadState, initUnloadWarning, scheduleSave } from "@app/persistence";
import { historyInit } from "@app/history";
import { wrapHandler } from "@app/handlerWrapper";
import {
  initFromStorage as initRenderPrefs,
  getPrefs as getRenderPrefs,
  toggleGuides, cycleEdge, getGuidesEnabled, getEdgePx,
} from "@app/renderPrefs";
import { makeSaveName, extractOriginalName } from "@app/filename";
import "./style.css";

/* ---------- Constants & safe storage ---------- */
export const LS_KEYS = { lastName: "last_pdf_name" };
export const AUTOSAVE_DELAY_MS = 50;
const NS = "annotator";
function safeSet(key, value) { try { localStorage.setItem(key, value); } catch {} }
function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }

/* ---------- Initialize render prefs ---------- */
updateRenderConfig(initRenderPrefs());
window.__snapGuidesEnabled = getGuidesEnabled();
window.__snapEdgePx = getEdgePx();

/* ---------- Global listeners (HMR-safe) ---------- */
let bootstrapped = false;

function onShortcut(e) {
  const cmd = e.metaKey || e.ctrlKey;
  if (!cmd) return;
  const key = e.key.toLowerCase();

  if (key === "g") {
    e.preventDefault();
    toggleGuides();
    updateRenderConfig(getRenderPrefs());
    window.__snapGuidesEnabled = getGuidesEnabled();
  } else if (key === "e") {
    e.preventDefault();
    cycleEdge();
    updateRenderConfig(getRenderPrefs());
    window.__snapEdgePx = getEdgePx();
  }
}

function onEsc(e) {
  if (e.key !== "Escape") return;
  const active = document.activeElement;
  if (active?.closest?.(".note-body, .text-body")) { active.blur(); return; }
  if (state.tool === "image") {
    const draggingPreview = document.querySelector(".image-box.preview");
    if (!draggingPreview) state.pendingImageSrc = null;
  }
}

function onRequestImage() { toolbarHandlers.onPickImage?.(); }

async function onDownloadRequested() {
  if (!state.loadedPdfData) { alert("Open a PDF first."); return; }
  const orig = state.originalFileName || safeGet(LS_KEYS.lastName);
  const saveAs = makeSaveName(orig);
  downloadAnnotatedPdf(state.loadedPdfData, saveAs);
}

function attachGlobalListeners() {
  if (bootstrapped) return;
  bootstrapped = true;
  window.addEventListener("keydown", onShortcut);
  document.addEventListener("keydown", onEsc);
  document.addEventListener(`${NS}:request-image`, onRequestImage);
  document.addEventListener(`${NS}:download-requested`, onDownloadRequested);

  if (import.meta?.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener("keydown", onShortcut);
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener(`${NS}:request-image`, onRequestImage);
      document.removeEventListener(`${NS}:download-requested`, onDownloadRequested);
      bootstrapped = false;
    });
  }
}

/* ---------- Wrap handlers with autosave + history ---------- */
const instrumentHandlers = (h) =>
  Object.fromEntries(Object.entries(h || {}).map(([k, fn]) => [k, wrapHandler(k, fn)]));

/* ---------- Toolbar handlers (no download logic here) ---------- */
const toolbarHandlers = {
  ...instrumentHandlers(handlers),
};

/* ---------- UI init ---------- */
initTextDrag();
initImageDrag();
createToolbar("toolbar", toolbarHandlers);
attachGlobalListeners();

/* ---------- File input wiring ---------- */
setupFileInput(async (picked, ...rest) => {
  const name = extractOriginalName(picked);
  if (name) {
    state.originalFileName = name;
    safeSet(LS_KEYS.lastName, name);
  }
  try {
    const res = await openFile(picked, ...rest);
    scheduleSave(AUTOSAVE_DELAY_MS);
    return res;
  } catch (err) {
    console.error("Failed to open file:", err);
  }
});

initHighlightDrag();
initNotePlacement();

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
