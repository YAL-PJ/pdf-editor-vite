/**
 * main.js
 * Bootstraps the app: toolbar, file input, and annotation tools.
 */
import { createToolbar } from "@ui/toolbar";
import { setupFileInput } from "@ui/uiHandlers";
import { openFile, handlers, restoreFile } from "@app/controller";
import { state } from "@app/state";
import { initHighlightDrag, initNotePlacement, initTextDrag, initImageDrag } from "@ui/overlay";
import { downloadAnnotatedPdf } from "./pdf/exportAnnotated.js";
import { loadState, initUnloadWarning } from "@app/persistence";
import "./style.css";

// Helper function to handle PDF download
const toolbarHandlers = {
    onDownloadAnnotated: () => downloadAnnotatedPdf(state.loadedPdfData, "annotated.pdf"),
    ...handlers
};

initTextDrag();
initImageDrag();

// Build toolbar and wire handlers
createToolbar("toolbar", toolbarHandlers);

// Attempt to load a saved state from sessionStorage
const wasStateRestored = loadState();

if (wasStateRestored) {
    console.log("Restoring saved PDF and annotations...");
    restoreFile();
}

// File input: load PDF into controller
setupFileInput(openFile);

// Init overlay tools (highlight + sticky notes)
initHighlightDrag();
initNotePlacement();

// Activate the unload warning
initUnloadWarning();