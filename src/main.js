/**
 * main.js — Bootstraps the app: build toolbar, wire input, register handlers.
 * Why: Keeps startup logic concise and readable.
 */
import { createToolbar } from "@ui/toolbar";
import { setupFileInput } from "@ui/uiHandlers";
import { openFile, handlers } from "@app/controller";

// Build toolbar and wire its buttons to controller logic
createToolbar("toolbar", handlers);

// File input: when a user selects a PDF, open it
setupFileInput(openFile);

