// File: src/ui/toolbar/events.js

/**
 * Event handling for toolbar buttons (supports both legacy and new IDs)
 * - Delegated single listener on #toolbar => no per-button duplicates.
 * - Idempotent rebinding with AbortController (HMR/re-bootstrap safe).
 * - Keeps rAF defers for smoothness.
 */

let _toolbarEvtController = null;

export function attachToolbarEvents(handlers) {
  const safe = (fn) => (typeof fn === "function" ? fn : () => {});
  const log  = (msg) => console.log(`[toolbar] ${msg}`);

  // Abort all previously attached listeners (idempotent)
  if (_toolbarEvtController) _toolbarEvtController.abort();
  _toolbarEvtController = new AbortController();
  const { signal } = _toolbarEvtController;

  const q = (id) => document.getElementById(id);
  const firstEl = (...ids) => ids.map(q).find(Boolean) || null;

  const toolbarEl = q("toolbar");
  if (!toolbarEl) {
    console.warn("[toolbar] #toolbar not found; events not attached");
    return;
  }

  // Map button ids (including legacy aliases) to click handlers
  const clickActions = {
    // Navigation
    prevPage: () => safe(handlers.onPrev)(),
    nextPage: () => safe(handlers.onNext)(),

    // Zoom
    zoomIn:  () => requestAnimationFrame(() => safe(handlers.onZoomIn)()),
    zoomOut: () => requestAnimationFrame(() => safe(handlers.onZoomOut)()),
    zoomFit: () => requestAnimationFrame(() => safe(handlers.onZoomFit)()), // optional

    // Tools (new + legacy ids)
    toolSelect:    () => safe(handlers.onToolChange)(null),
    btnSelect:     () => safe(handlers.onToolChange)(null),

    toolHighlight: () => safe(handlers.onToolChange)("highlight"),
    btnHighlight:  () => safe(handlers.onToolChange)("highlight"),

    toolNote:      () => safe(handlers.onToolChange)("note"),
    btnNote:       () => safe(handlers.onToolChange)("note"),

    toolText:      () => safe(handlers.onToolChange)("text"),
    btnText:       () => safe(handlers.onToolChange)("text"),

    toolImage:     () => {
      // Defer tool change, then open picker (keeps click task light)
      requestAnimationFrame(() => {
        safe(handlers.onToolChange)("image");
        setTimeout(() => safe(handlers.onPickImage)(), 0);
      });
    },
    btnImage:      () => safe(handlers.onToolChange)("image"),
    btnPickImage:  () => safe(handlers.onPickImage)(),

    // Undo/Redo
    btnUndo: () => safe(handlers.onUndo)(),
    btnRedo: () => safe(handlers.onRedo)(),

    // Download
    btnDownloadAnnotated: () => {
      log("Download annotated");
      requestAnimationFrame(() => {
        document.dispatchEvent(new CustomEvent("annotator:download-requested"));
        safe(handlers.onDownloadAnnotated)(); // back-compat if still wired
      });
    },
  };

  // Single delegated click listener on the toolbar container
  toolbarEl.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest("button");
      if (!btn || !toolbarEl.contains(btn)) return;

      const id = btn.id;
      const fn = clickActions[id];
      if (!fn) return;

      e.preventDefault();
      fn();
    },
    { signal }
  );

  // Hidden file input(s) for images (outside toolbar click delegation)
  // Preferred: imagePickerInput; Legacy: imagePicker
  const picker = firstEl("imagePickerInput", "imagePicker");
  if (picker && handlers.onImageSelected) {
    picker.addEventListener(
      "change",
      async (e) => {
        const file = e.target.files?.[0];
        try {
          if (file) await safe(handlers.onImageSelected)(file);
        } finally {
          try { e.target.value = ""; } catch {}
        }
      },
      { signal }
    );
  }

  // Keyboard shortcuts (global). Bind via same controller for clean teardown.
  const isEditableTarget = (el) => {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return true;
    if (el.getAttribute?.("role") === "textbox") return true;
    if (el.isContentEditable) return true;
    if (el.closest?.("[contenteditable='true']")) return true;
    if (el.closest?.(".text-body[contenteditable='true']")) return true;
    if (el.closest?.(".note-body[contenteditable='true']")) return true;
    return false;
  };

  const onKeyDown = (e) => {
    if (isEditableTarget(e.target)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    const key = e.key.toLowerCase();

    // Undo (Cmd/Ctrl+Z)
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

  document.addEventListener("keydown", onKeyDown, { signal });

  // A11y: set aria-keyshortcuts if buttons exist (optional)
  const undoBtn = q("btnUndo");
  const redoBtn = q("btnRedo");
  if (undoBtn) undoBtn.setAttribute("aria-keyshortcuts", "Ctrl+Z Meta+Z");
  if (redoBtn) redoBtn.setAttribute("aria-keyshortcuts", "Ctrl+Shift+Z Ctrl+Y Meta+Shift+Z");

  log("events attached (delegated)");
}
  
/* HMR-safe: when this module is disposed, abort listeners */
if (import.meta?.hot) {
  import.meta.hot.dispose(() => {
    if (_toolbarEvtController) _toolbarEvtController.abort();
    _toolbarEvtController = null;
  });
}
