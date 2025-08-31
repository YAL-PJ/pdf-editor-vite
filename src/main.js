/**
 * main.js
 * - Bootstraps UI + persistence
 * - Autosave & history for state-changing handlers
 * - (NEW) Overlay config init + quick keyboard toggles
 */
import { createToolbar } from "@ui/toolbar";
import { setupFileInput } from "@ui/uiHandlers";
import { openFile, handlers, restoreFile } from "@app/controller";
import { state } from "@app/state";
import {
  initHighlightDrag,
  initNotePlacement,
  initTextDrag,
  initImageDrag,
} from "@ui/overlay";
import { updateRenderConfig } from "@ui/overlay/render.js"; // NEW: tweak snapping/guides
import { downloadAnnotatedPdf } from "./pdf/exportAnnotated.js";
import { loadState, initUnloadWarning, scheduleSave } from "@app/persistence";
import { historyInit, historyBegin, historyCommit } from "@app/history";
import "./style.css";

/* ---------- Filename helpers ---------- */
const makeSaveName = (originalName, marker = " (annotated)") => {
  if (!originalName) return "annotated.pdf";
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  const ext  = dot > 0 ? originalName.slice(dot) : ".pdf";
  const escMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cleanBase = base.replace(new RegExp(`${escMarker}$`), "");
  return `${cleanBase}${marker}${ext}`;
};

const extractOriginalName = (picked) => {
  if (!picked) return null;
  // Event from <input type="file">?
  const t = picked.target || picked.currentTarget;
  const filesFromEvent = t?.files;
  if (filesFromEvent?.[0]?.name) return filesFromEvent[0].name;

  // Direct File or wrapper { file: File }
  if (picked?.name && typeof picked.name === "string") return picked.name;
  if (picked?.file?.name) return picked.file.name;

  // Some handlers pass (File, ...rest)
  if (picked instanceof File && picked.name) return picked.name;

  return null;
};

/* ---------- Overlay config init (optional but handy) ---------- */
const persisted = JSON.parse(localStorage.getItem("annotator_prefs") || "{}");
if (persisted && typeof persisted === "object") {
  updateRenderConfig(persisted);
  // remember in globals so the shortcut UI reflects state
  if (persisted.snapToGuides != null) window.__snapGuidesEnabled = !!persisted.snapToGuides;
  if (persisted.snapEdgePx   != null) window.__snapEdgePx       = +persisted.snapEdgePx;
}
const persistPrefs = (patch) => {
  const cur = JSON.parse(localStorage.getItem("annotator_prefs") || "{}");
  localStorage.setItem("annotator_prefs", JSON.stringify({ ...cur, ...patch }));
};

/* Keyboard shortcuts:
   - Ctrl/Cmd+G: toggle magnetic guide snapping
   - Ctrl/Cmd+E: cycle edge snap threshold 4→8→12→16→4...
*/
window.addEventListener("keydown", (e) => {
  const cmd = e.metaKey || e.ctrlKey;
  if (!cmd) return;

  const key = e.key.toLowerCase();
  if (key === "g") {
    e.preventDefault();
    const enabled = !(window.__snapGuidesEnabled ?? true);
    window.__snapGuidesEnabled = enabled;
    updateRenderConfig({ snapToGuides: enabled });
    persistPrefs({ snapToGuides: enabled });
  } else if (key === "e") {
    e.preventDefault();
    const next = ((window.__snapEdgePx ?? 8) % 16) + 4; // 8→12→16→4...
    window.__snapEdgePx = next;
    updateRenderConfig({ snapEdgePx: next });
    persistPrefs({ snapEdgePx: next });
  }
});

/* ---------- Wrap handlers with autosave + history ---------- */
const wrapHandler = (name, fn) => {
  const skip = new Set(["onUndo", "onRedo"]);
  if (skip.has(name)) return fn;
  return (...args) => {
    historyBegin();
    const out = fn?.(...args);
    const finish = () => { historyCommit(); scheduleSave(); };
    if (out && typeof out.then === "function") {
      return out.then((v) => { finish(); return v; })
                .catch((e) => { finish(); throw e; });
    }
    finish();
    return out;
  };
};

const instrumentHandlers = (h) =>
  Object.fromEntries(Object.entries(h || {}).map(([k, fn]) => [k, wrapHandler(k, fn)]));

/* ---------- Toolbar handlers ---------- */
const toolbarHandlers = {
  onDownloadAnnotated: () => {
    if (!state.loadedPdfData) { alert("Open a PDF first."); return; }
    const orig = state.originalFileName || localStorage.getItem("last_pdf_name");
    const saveAs = makeSaveName(orig);
    downloadAnnotatedPdf(state.loadedPdfData, saveAs);
  },
  ...instrumentHandlers(handlers),
};

/* ---------- UI init ---------- */
initTextDrag();
initImageDrag();
createToolbar("toolbar", toolbarHandlers);

setupFileInput(async (picked, ...rest) => {
  // Capture and persist the original file name for later downloads
  const name = extractOriginalName(picked);
  if (name) {
    state.originalFileName = name;
    try { localStorage.setItem("last_pdf_name", name); } catch {}
  }

  try {
    const res = await openFile(picked, ...rest);
    scheduleSave(50);
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
    // Rehydrate name so downloads still use it after refresh/restore
    const last = localStorage.getItem("last_pdf_name");
    if (last) state.originalFileName = last;

    restoreFile();
    scheduleSave(50);
  } catch (e) {
    console.error("Restore failed", e);
  }
}
initUnloadWarning();

/* ---------- Start history baseline ---------- */
historyInit();
