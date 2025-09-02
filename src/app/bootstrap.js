// src/app/bootstrap.js
// Bootstraps UI: toolbar, overlay tools, file input wiring, and handler wrapping.
// No global listeners here; those live in src/app/listeners.js.

import { createToolbar } from "@ui/toolbar";
import { setupFileInput } from "@ui/uiHandlers";
import { initTextDrag, initImageDrag, initHighlightDrag, initNotePlacement } from "@ui/overlay";
import { wrapHandler } from "@app/handlerWrapper";
import { scheduleSave } from "@app/persistence";
import { state } from "@app/state";

/** Internal: wrap every handler with history+autosave semantics */
const instrumentHandlers = (h) =>
  Object.fromEntries(Object.entries(h || {}).map(([k, fn]) => [k, wrapHandler(k, fn)]));

/**
 * bootstrapUI
 * @param {{
 *   handlers: Record<string, Function>,
 *   openFile: (picked: any, ...rest:any[]) => Promise<any> | any,
 *   extractOriginalName: (picked:any)=>string|null,
 *   autosaveDelayMs: number,
 *   lsKeys: { lastName: string }
 * }} deps
 */
export function bootstrapUI({ handlers, openFile, extractOriginalName, autosaveDelayMs, lsKeys }) {
  // Overlay tools (drag/placement)
  initTextDrag();
  initImageDrag();
  initHighlightDrag();
  initNotePlacement();

  // Toolbar with instrumented handlers; download handled by listeners/main
  const toolbarHandlers = {
    ...instrumentHandlers(handlers),
  };
  createToolbar("toolbar", toolbarHandlers);

  // Wire file input: store original name for export/restore; open file; autosave
  setupFileInput(async (picked, ...rest) => {
    const name = extractOriginalName(picked);
    if (name) {
      state.originalFileName = name;
      try { localStorage.setItem(lsKeys.lastName, name); } catch {}
    }
    try {
      const res = await openFile(picked, ...rest);
      scheduleSave(autosaveDelayMs);
      return res;
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  });

  return { toolbarHandlers };
}
