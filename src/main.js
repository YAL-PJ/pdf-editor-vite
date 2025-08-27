/**
 * main.js
 * - Bootstraps UI + persistence
 * - Autosave & history for state-changing handlers
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
import { downloadAnnotatedPdf } from "./pdf/exportAnnotated.js";
import { loadState, initUnloadWarning, scheduleSave } from "@app/persistence";
import { historyInit, historyBegin, historyCommit } from "@app/history";
import "./style.css";

/* Wrap handlers with autosave + history (skip undo/redo themselves) */
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

/* Toolbar handlers */
const toolbarHandlers = {
  onDownloadAnnotated: () => {
    if (!state.loadedPdfData) { alert("Open a PDF first."); return; }
    downloadAnnotatedPdf(state.loadedPdfData, "annotated.pdf");
  },
  ...instrumentHandlers(handlers),
};

/* UI init */
initTextDrag();
initImageDrag();
createToolbar("toolbar", toolbarHandlers);
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
    scheduleSave(50);
  } catch (e) {
    console.error("Restore failed", e);
  }
}
initUnloadWarning();

// Start history baseline
historyInit();
