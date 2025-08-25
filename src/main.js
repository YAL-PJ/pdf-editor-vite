/**
 * main.js
 * Bootstraps the app: toolbar, file input, and annotation tools.
 */
import { createToolbar } from "@ui/toolbar";
import { setupFileInput } from "@ui/uiHandlers";
import { openFile, handlers } from "@app/controller";
import { initHighlightDrag, initNotePlacement,initTextDrag, initImageDrag } from "@ui/overlay";
import "./style.css";

initTextDrag();
initImageDrag();

// Build toolbar and wire handlers
createToolbar("toolbar", handlers);

// File input: load PDF into controller
setupFileInput(openFile);

// Init overlay tools (highlight + sticky notes)
initHighlightDrag();
initNotePlacement();
