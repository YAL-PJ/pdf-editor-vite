/**
 * controller.js
 * Central app logic: manages state, rendering, toolbar updates, and persistence.
 */
import { state } from "@app/state";
import { ui, setToolbarEnabled, setActiveToolButton } from "@ui/toolbar";
import { loadPDF } from "@pdf/pdfLoader";
import { getIsRendering } from "@pdf/pdfRenderer";
import {
  renderAnnotationsForPage,
  setOverlayCursor,
  syncOverlayToCanvas,
  clearOverlay,
} from "@ui/overlay";
import { saveState, hasDataToLose, clearSavedState } from "./persistence";
import { undo, redo, historyInit } from "@app/history";
import { downloadAnnotatedPdf } from "@pdf/exportAnnotated";

import "../styles/switch-dialog.css";

/* ---------- Small helpers ---------- */
const getFileInputEl = () => document.getElementById("fileInput");
const getViewerEl    = () => document.getElementById("viewer");
const getCanvasEl    = () => document.getElementById("pdfCanvas");

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
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
      if (e.target.tagName === "BUTTON") close(e.target.getAttribute("data-act"));
    }
    function onKey(e) {
      if (e.key === "Escape") close("cancel");
    }
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    document.body.appendChild(root);

    const firstBtn = root.querySelector("button[data-act]");
    firstBtn?.focus();
  });
}

/* ---------- Public: reset the whole document session ---------- */
export async function resetDocumentState() {
  const canvas = getCanvasEl();
  const ctx = canvas?.getContext?.("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

  clearOverlay?.();

  state.pdfDoc = null;
  state.loadedPdfData = null;
  state.pageNum = 1;
  state.scale = 1.0;
  state.annotations = {};
  state.viewports = {};
  state.pendingImageSrc = null;
  state.currentDocId = null;

  setActiveToolButton(null);
  setOverlayCursor(null);

  // Restore "placeholder" so CSS reserves aspect-only space again
  getViewerEl()?.classList.add("placeholder");

  await clearSavedState();
  historyInit();
}

/* ---------- Render current page (CLS-safe + crisp + zoom-preserving) ---------- */
export async function rerender() {
  if (!state.pdfDoc) return;
  if (getIsRendering && getIsRendering()) return;

  setToolbarEnabled(false);
  try {
    const page   = await state.pdfDoc.getPage(state.pageNum);
    const canvas = getCanvasEl();
    const viewer = getViewerEl() || canvas?.parentElement;
    if (!canvas || !viewer) return;

    // 1) Compute scale: fit-to-width * current zoom (state.scale)
    const baseVp    = page.getViewport({ scale: 1 });
    const available = Math.max(1, viewer.clientWidth);
    const fitScale  = available / baseVp.width;
    const scale     = fitScale * state.scale;
    const vp        = page.getViewport({ scale });

    // 2) Set CSS box size *before* rendering (prevents CLS),
    //    then set backing store for crisp output.
    const dpr  = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const cssW = Math.round(vp.width);
    const cssH = Math.round(vp.height);

    canvas.style.width  = `${cssW}px`;  // affects layout
    canvas.style.height = `${cssH}px`;  // affects layout
    canvas.width  = cssW * dpr;         // raster only
    canvas.height = cssH * dpr;         // raster only

    const ctx = canvas.getContext("2d", { alpha: false });

    // 3) Render and keep overlay in sync with the SAME viewport
    await page.render({ canvasContext: ctx, viewport: vp, intent: "display" }).promise;

    if (!state.viewports) state.viewports = {};
    state.viewports[state.pageNum] = vp;

    syncOverlayToCanvas();
    renderAnnotationsForPage(state.pageNum, vp);

    ui.pageNumEl().textContent   = String(state.pageNum);
    ui.zoomLevelEl().textContent = `${Math.round(state.scale * 100)}%`;
  } finally {
    setToolbarEnabled(true);
  }
}

/* ---------- Open PDF ---------- */
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

    await resetDocumentState();
  }

  // Fresh open
  const { doc, rawData } = await loadPDF(file);

  // Defer removing placeholder until after the first render (prevents jump)
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
  getViewerEl()?.classList.remove("placeholder"); // remove after first layout-stable render
  historyInit();
  saveState();
}

/* ---------- Restore PDF ---------- */
export async function restoreFile() {
  if (!state.loadedPdfData) {
    console.warn("No loaded PDF data to restore.");
    return;
  }
  const restoredFile = new File([state.loadedPdfData], "restored.pdf");
  const { doc } = await loadPDF(restoredFile);

  clearOverlay();
  state.pdfDoc = doc;
  state.currentDocId = makeDocId(restoredFile);
  ui.pageCountEl().textContent = String(state.pdfDoc.numPages);

  await rerender();
  getViewerEl()?.classList.remove("placeholder"); // remove after first layout-stable render
  historyInit();
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
    state.tool = tool || null;
    setActiveToolButton(tool || null);
    setOverlayCursor(tool || null);
  },
  onPickImage: () => {
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
      state.pendingImageSrc = await toDataURL(file);
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
