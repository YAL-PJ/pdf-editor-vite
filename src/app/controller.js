/**
 * controller.js
 * Central app logic: manages state, rendering, toolbar updates, and persistence.
 */
import { state } from "@app/state";
import { ui, setToolbarEnabled, setActiveToolButton } from "@ui/toolbar";
import { loadPDF } from "@pdf/pdfLoader";
import { renderPage, getIsRendering } from "@pdf/pdfRenderer";
import {
  renderAnnotationsForPage,
  setOverlayCursor,
  syncOverlayToCanvas,
  clearOverlay,
} from "@ui/overlay";
import {
  saveState,
  hasDataToLose,
  clearSavedState,
} from "./persistence";
import { undo, redo, historyInit } from "@app/history";
import { downloadAnnotatedPdf } from "@pdf/exportAnnotated";

// Modal styles (CSS-only, no inline styles)
import "../styles/switch-dialog.css";

/* ---------- Small helpers ---------- */
const getFileInputEl = () => document.getElementById("fileInput");
const makeDocId = (file) =>
  file ? `${file.name}|${file.size}|${file.lastModified || 0}` : null;

const makeSaveName = (originalName, marker = " (annotated)") => {
  if (!originalName) return "annotated.pdf";
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  const ext  = dot > 0 ? originalName.slice(dot) : ".pdf";
  const escMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cleanBase = base.replace(new RegExp(`${escMarker}$`), "");
  return `${cleanBase}${marker}${ext}`;
};

const escapeHtml = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/* ---------- Minimal, accessible switch dialog ---------- */
function showSwitchDialog(nextName) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.innerHTML = `
      <div class="switchdlg-backdrop" role="dialog" aria-modal="true" aria-labelledby="switchdlg-title">
        <div class="switchdlg-card" role="document">
          <h2 class="switchdlg-title" id="switchdlg-title">Switch PDF?</h2>
          <p class="switchdlg-body">
            You have a document open with annotations. Opening
            <b>${escapeHtml(nextName)}</b> will clear them in this window.
          </p>
          <div class="switchdlg-actions">
            <button class="switchdlg-btn" data-act="save">Save & Replace</button>
            <button class="switchdlg-btn" data-act="discard">Replace (discard)</button>
            <button class="switchdlg-btn" data-act="newtab">Open in new window</button>
            <button class="switchdlg-btn switchdlg-btn-secondary" data-act="cancel">Cancel</button>
          </div>
        </div>
      </div>`.trim();

    const root = host.firstElementChild;
    function close(act) {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
      document.body.removeChild(root);
      resolve(act);
    }
    function onClick(e) {
      if (e.target.tagName === "BUTTON") {
        close(e.target.getAttribute("data-act"));
      }
    }
    function onKey(e) {
      if (e.key === "Escape") close("cancel");
    }
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    document.body.appendChild(root);

    // Focus the first button for keyboard users
    const firstBtn = root.querySelector("button[data-act]");
    firstBtn?.focus();
  });
}

/* ---------- Public: reset the whole document session ---------- */
export async function resetDocumentState() {
  // clear canvas
  const canvas = document.getElementById("pdfCanvas");
  const ctx = canvas?.getContext?.("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

  // clear overlay
  clearOverlay?.();

  // clear in-memory state
  state.pdfDoc = null;
  state.loadedPdfData = null;
  state.pageNum = 1;
  state.scale = 1.0;
  state.annotations = {};
  state.viewports = {};
  state.pendingImageSrc = null;
  state.currentDocId = null;

  // reset UI tool state
  setActiveToolButton(null);
  setOverlayCursor(null);

  // clear persisted draft + reset history baseline
  await clearSavedState();
  historyInit();
}

/* ---------- Render current page ---------- */
export async function rerender() {
  if (!state.pdfDoc) return;
  if (getIsRendering()) return;

  setToolbarEnabled(false);
  try {
    const { viewport } = await renderPage(state.pdfDoc, state.pageNum, state.scale);
    syncOverlayToCanvas();

    if (!state.viewports) state.viewports = {};
    state.viewports[state.pageNum] = viewport;

    ui.pageNumEl().textContent   = String(state.pageNum);
    ui.zoomLevelEl().textContent = `${Math.round(state.scale * 100)}%`;

    renderAnnotationsForPage(state.pageNum, viewport);
  } finally {
    setToolbarEnabled(true);
  }
}

/* ---------- Open PDF (with safe switch guard) ---------- */
export async function openFile(file) {
  const nextId = makeDocId(file);
  const currId = state.currentDocId || null;

  if (currId && nextId && currId !== nextId && hasDataToLose()) {
    const choice = await showSwitchDialog(file.name);

    if (choice === "cancel") {
      try { const el = getFileInputEl(); if (el) el.value = ""; } catch {}
      return;
    }

    if (choice === "newtab") {
      window.open(window.location.href, "_blank", "noopener");
      try { const el = getFileInputEl(); if (el) el.value = ""; } catch {}
      return;
    }

    if (choice === "save") {
      try {
        if (state.loadedPdfData) {
          const orig = state.originalFileName || localStorage.getItem("last_pdf_name") || "document.pdf";
          const saveAs = makeSaveName(orig);
          await downloadAnnotatedPdf(state.loadedPdfData, saveAs);
        }
      } catch (e) {
        console.error("Download annotated failed:", e);
      }
    }

    await resetDocumentState(); // discard current in this window
  }

  // Fresh open
  const { doc, rawData } = await loadPDF(file);

  // Clean slate for annotations/UI for the new doc
  clearOverlay();
  state.pdfDoc = doc;
  state.loadedPdfData = rawData;
  state.pageNum = 1;
  state.annotations = {};
  state.viewports = {};
  state.pendingImageSrc = null;
  state.currentDocId = nextId || null;
  state.originalFileName = file?.name || state.originalFileName;
  try { if (file?.name) localStorage.setItem("last_pdf_name", file.name); } catch {}

  ui.pageCountEl().textContent = String(state.pdfDoc.numPages);
  await rerender();
  historyInit();   // reset history baseline
  saveState();
}

/* ---------- Restore PDF from saved data ---------- */
export async function restoreFile() {
  if (!state.loadedPdfData) {
    console.warn("No loaded PDF data to restore.");
    return;
  }
  const restoredFile = new File([state.loadedPdfData], "restored.pdf");
  const { doc } = await loadPDF(restoredFile);
  state.pdfDoc = doc;
  state.currentDocId = makeDocId(restoredFile);
  ui.pageCountEl().textContent = String(state.pdfDoc.numPages);
  await rerender();
  historyInit();   // reset baseline after restore
}

/* ---------- Toolbar handlers ---------- */
export const handlers = {
  onPrev: async () => {
    if (!state.pdfDoc || state.pageNum <= 1) return;
    state.pageNum -= 1;
    await rerender();
  },
  onNext: async () => {
    if (!state.pdfDoc || state.pageNum >= state.pdfDoc.numPages) return;
    state.pageNum += 1;
    await rerender();
  },
  onZoomIn: async () => {
    if (!state.pdfDoc) return;
    state.scale = Math.min(state.scale + 0.1, 3.0);
    await rerender();
  },
  onZoomOut: async () => {
    if (!state.pdfDoc) return;
    state.scale = Math.max(state.scale - 0.1, 0.3);
    await rerender();
  },

    onToolChange: (tool) => {
    console.time('toolChange-total');
    
    console.time('toolChange-state');
    state.tool = tool || null;
    console.timeEnd('toolChange-state');
    
    console.time('toolChange-button');
    setActiveToolButton(tool || null);
    console.timeEnd('toolChange-button');
    
    console.time('toolChange-cursor');
    setOverlayCursor(tool || null);
    console.timeEnd('toolChange-cursor');
    
    console.timeEnd('toolChange-total');
  },
  onPickImage: () => {
    // ID fixed to match your HTML: #imagePickerInput
    const picker = document.getElementById("imagePickerInput");
    if (picker) picker.click();
  },
  onImageSelected: async (file) => {
    const toDataURL = (f) =>
      new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
    try {
      state.pendingImageSrc = await toDataURL(file); // sticky clipboard
      state.tool = "image";
      setActiveToolButton("image");
      setOverlayCursor("image");
    } catch (e) {
      console.error("Failed to read image file", e);
    }
  },
  onUndo: async () => { if (undo()) await rerender(); },
  onRedo: async () => { if (redo()) await rerender(); },
};
