/**
 * main.js
 * Bootstraps the app: toolbar, file input, and annotation tools.
 */
import { createToolbar } from "@ui/toolbar";
import { setupFileInput } from "@ui/uiHandlers";
import { openFile, handlers, state } from "@app/controller"; // Note: Added 'state' export
import { initHighlightDrag, initNotePlacement, initTextDrag, initImageDrag } from "@ui/overlay";
import { downloadAnnotatedPdf } from "./pdf/exportAnnotated.js";
import "./style.css";

// Helper function to handle PDF download
// The raw PDF data is now accessed from the global state object.
const toolbarHandlers = {
    onDownloadAnnotated: () => downloadAnnotatedPdf(state.loadedPdfData, "annotated.pdf"),
    ...handlers // Merge with other handlers from the controller
};

initTextDrag();
initImageDrag();

// Build toolbar and wire handlers
// Pass the new toolbarHandlers object
createToolbar("toolbar", toolbarHandlers);

// File input: load PDF into controller
setupFileInput(openFile);

// Init overlay tools (highlight + sticky notes)
initHighlightDrag();
initNotePlacement();