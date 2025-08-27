/**
 * main.js
 * - Bootstraps UI + persistence
 * - Debounced autosave for any state-changing handler
 * - No warning on refresh; warn on real leave
 */

import { createToolbar } from "@ui/toolbar";
import { setupFileInput } from "@ui/uiHandlers";
import { openFile, handlers, restoreFile } from "@app/controller";
import { state } from "@app/state";
import { initHighlightDrag, initNotePlacement, initTextDrag, initImageDrag } from "@ui/overlay";
import { downloadAnnotatedPdf } from "./pdf/exportAnnotated.js";
import { loadState, initUnloadWarning, scheduleSave } from "@app/persistence";
import "./style.css";

/* Wrap state-mutating handlers to autosave */
const withAutoSave = (fn) => (...args) => {
  const out = fn?.(...args);
  if (out && typeof out.then === "function") {
    return out
      .then((v) => { scheduleSave(); return v; })
      .catch((e) => { scheduleSave(); throw e; });
  }
  scheduleSave();
  return out;
};

const instrumentHandlers = (h) =>
  Object.fromEntries(Object.entries(h || {}).map(([k, fn]) => [k, withAutoSave(fn)]));

/* Toolbar handlers */
const toolbarHandlers = {
  onDownloadAnnotated: () => {
    if (!state.loadedPdfData) { alert("Open a PDF first."); return; }
    downloadAnnotatedPdf(state.loadedPdfData, "annotated.pdf");
  },
  ...instrumentHandlers(handlers)
};

/* UI init */
initTextDrag();
initImageDrag();
createToolbar("toolbar", toolbarHandlers);

// Ensure file-open actions also trigger a save (so a quick leave can restore)
setupFileInput(async (...args) => {
  try {
    const res = await openFile(...args);
    scheduleSave(50);
    return res;
  } catch (err) {
    console.error("Failed to open file:", err);
  }
});

initHighlightDrag();
initNotePlacement();

/* Restore + lifecycle */
const wasStateRestored = await loadState();
if (wasStateRestored) {
  try {
    restoreFile();
    // ensure meta is fresh so refresh won't warn right after restore
    scheduleSave(50);
  } catch (e) {
    console.error("Restore failed", e);
  }
}
initUnloadWarning();
