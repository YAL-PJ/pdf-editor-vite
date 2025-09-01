/**
 * Event handling for toolbar buttons (supports both legacy and new IDs)
 */

let _keyboardHandler = null; // avoid duplicate listeners

export function attachToolbarEvents(handlers) {
  const safe = (fn) => (typeof fn === "function" ? fn : () => {});
  const log  = (msg) => console.log(`[toolbar] ${msg}`);

  // ---------- helpers ----------
  const q = (id) => document.getElementById(id);
  const firstEl = (...ids) => ids.map(q).find(Boolean) || null;

  const bind = (ids, fn, msg) => {
    const el = Array.isArray(ids) ? firstEl(...ids) : q(ids);
    if (!el) return;
    el.addEventListener("click", () => { if (msg) log(msg); safe(fn)(); });
  };

  const bindTool = (ids, tool, label) =>
    bind(ids, () => safe(handlers.onToolChange)(tool), `${label} tool`);

  // ---------- Navigation ----------
  bind("prevPage", handlers.onPrev, "Prev page");
  bind("nextPage", handlers.onNext, "Next page");

  // ---------- Zoom ----------
  bind("zoomIn",  handlers.onZoomIn,  "Zoom in");
  bind("zoomOut", handlers.onZoomOut, "Zoom out");
  // Optional zoomFit (present in some templates)
  bind("zoomFit", handlers.onZoomFit, "Zoom fit");

  // ---------- Tools (support both ID styles) ----------
  bindTool(["toolSelect", "btnSelect"], null, "Select");
  bindTool(["toolHighlight", "btnHighlight"], "highlight", "Highlight");
  bindTool(["toolNote", "btnNote"], "note", "Note");
  bindTool(["toolText", "btnText"], "text", "Text");

  // Image tool:
  // - If template has a combined "toolImage", set tool and immediately open picker
  // - Otherwise use separate "btnImage" (just select tool) and/or "btnPickImage" (open picker)
  bind("toolImage", () => {
    safe(handlers.onToolChange)("image");
    safe(handlers.onPickImage)();
  }, "Image tool");

  bind("btnImage", () => {
    safe(handlers.onToolChange)("image");
  }, "Image tool");

  bind("btnPickImage", handlers.onPickImage, "Pick image");

  // ---------- Hidden file input(s) for images ----------
  // Preferred: imagePickerInput; Legacy: imagePicker
  const picker = firstEl("imagePickerInput", "imagePicker");
  if (picker && handlers.onImageSelected) {
    picker.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      try {
        if (file) {
          await safe(handlers.onImageSelected)(file); // should set pendingImageSrc & tool
        }
      } finally {
        // allow re-picking the same file name
        try { e.target.value = ""; } catch {}
      }
    });
  }

  // ---------- Download annotated (decoupled + back-compat) ----------
  bind("btnDownloadAnnotated", () => {
    log("Download annotated");
    document.dispatchEvent(new CustomEvent("annotator:download-requested"));
    safe(handlers.onDownloadAnnotated)(); // back-compat if still wired
  }, "Download annotated");

  // ---------- Undo / Redo ----------
  bind("btnUndo", handlers.onUndo, "Undo");
  bind("btnRedo", handlers.onRedo, "Redo");

  // Optional a11y hint: expose keyboard shortcuts if buttons exist
  const undoBtn = q("btnUndo");
  const redoBtn = q("btnRedo");
  if (undoBtn) undoBtn.setAttribute("aria-keyshortcuts", "Ctrl+Z Meta+Z");
  if (redoBtn) redoBtn.setAttribute("aria-keyshortcuts", "Ctrl+Shift+Z Ctrl+Y Meta+Shift+Z");

  // ---------- Keyboard shortcuts (Undo/Redo) ----------
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

  // Remove previous global listener if re-attached (e.g., HMR)
  if (_keyboardHandler) {
    document.removeEventListener("keydown", _keyboardHandler);
  }

  _keyboardHandler = (e) => {
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

  document.addEventListener("keydown", _keyboardHandler);
}
