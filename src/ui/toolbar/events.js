/**
 * Event handling for toolbar buttons
 */

let _keyboardHandler = null; // keep reference to avoid duplicate listeners

export function attachToolbarEvents(handlers) {
  const safe = (fn) => (typeof fn === "function" ? fn : () => {});
  const log  = (msg) => console.log(`[toolbar] ${msg}`);

  // ---- helpers ----
  const q = (id) => document.getElementById(id);
  const bind = (id, fn, msg) => {
    const el = q(id);
    if (!el) return;
    el.addEventListener("click", () => { if (msg) log(msg); safe(fn)(); });
  };
  const bindTool = (id, tool, label) =>
    bind(id, () => safe(handlers.onToolChange)(tool), `${label} tool`);

  // ---- Navigation ----
  bind("prevPage", handlers.onPrev, "Prev page");
  bind("nextPage", handlers.onNext, "Next page");

  // ---- Zoom ----
  bind("zoomIn",  handlers.onZoomIn,  "Zoom in");
  bind("zoomOut", handlers.onZoomOut, "Zoom out");

  // ---- Tools ----
  bindTool("toolSelect",    null,        "Select");
  bindTool("toolHighlight", "highlight", "Highlight");
  bindTool("toolNote",      "note",      "Note");
  bindTool("toolText",      "text",      "Text");
  bind("toolImage",         handlers.onPickImage, "Image tool → open picker");

  // ---- Image file input (hidden <input id="imagePicker" accept="image/*">) ----
  const picker = q("imagePicker");
  if (picker && handlers.onImageSelected) {
    picker.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) safe(handlers.onImageSelected)(file);
      // allow re-picking the same file
      e.target.value = "";
    });
  }

  // ---- Download annotated ----
  bind("btnDownloadAnnotated", handlers.onDownloadAnnotated, "Download annotated");

  // ---- Undo / Redo ----
  bind("btnUndo", handlers.onUndo, "Undo");
  bind("btnRedo", handlers.onRedo, "Redo");

  // Optional a11y hint for screen readers: expose keyboard shortcuts
  const undoBtn = q("btnUndo");
  const redoBtn = q("btnRedo");
  if (undoBtn) undoBtn.setAttribute("aria-keyshortcuts", "Ctrl+Z Meta+Z");
  if (redoBtn) redoBtn.setAttribute("aria-keyshortcuts", "Ctrl+Shift+Z Ctrl+Y Meta+Shift+Z");

  // ---- Keyboard shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z or Ctrl+Y) ----
  const isEditableTarget = (el) => {
    if (!el) return false;
    // standard form controls
    const tag = el.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return true;
    // aria textbox roles
    if (el.getAttribute?.("role") === "textbox") return true;
    // native or ancestor contenteditable
    if (el.isContentEditable) return true;
    if (el.closest?.("[contenteditable='true']")) return true;
    // our custom editable area
    if (el.closest?.(".text-body[contenteditable='true']")) return true;
    return false;
    };

  // Remove previous global listener if this gets called again (e.g., hot reload)
  if (_keyboardHandler) {
    document.removeEventListener("keydown", _keyboardHandler);
  }

  _keyboardHandler = (e) => {
    if (isEditableTarget(e.target)) return;

    // treat both Cmd and Ctrl as modifiers for cross-platform parity
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    const key = e.key.toLowerCase();

    // Undo
    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      safe(handlers.onUndo)();
      return;
    }

    // Redo (Cmd/Ctrl+Shift+Z or Ctrl+Y)
    if ((key === "z" && e.shiftKey) || key === "y") {
      e.preventDefault();
      safe(handlers.onRedo)();
    }
  };

  document.addEventListener("keydown", _keyboardHandler);
}
