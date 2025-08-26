/**
 * main.js
 * Bootstraps the app: toolbar, file input, and annotation tools.
 */
import { createToolbar } from "@ui/toolbar";
import { setupFileInput } from "@ui/uiHandlers";
import { state } from "@app/state";
import { openFile, handlers, restoreFile } from "@app/controller";
import { initHighlightDrag, initNotePlacement, initTextDrag, initImageDrag } from "@ui/overlay";
import { downloadAnnotatedPdf } from "./pdf/exportAnnotated.js";
import { loadState } from "@app/persistence"; // NEW: Import loadState from the new persistence file
import "./style.css";

// Helper function to handle PDF download
const toolbarHandlers = {
    onDownloadAnnotated: () => downloadAnnotatedPdf(state.loadedPdfData, "annotated.pdf"),
    ...handlers // Merge with other handlers from the controller
};

initTextDrag();
initImageDrag();

// Build toolbar and wire handlers
// Pass the new toolbarHandlers object
createToolbar("toolbar", toolbarHandlers);

// Attempt to load a saved state from localStorage
const wasStateRestored = loadState();

// If a saved state was successfully loaded, restore the PDF document
if (wasStateRestored) {
  console.log("Restoring saved PDF and annotations...");
  restoreFile();
}

// File input: load PDF into controller
// Note: This will be the primary way to load a new file if one wasn't restored
setupFileInput(openFile);

// Init overlay tools (highlight + sticky notes)
initHighlightDrag();
initNotePlacement();