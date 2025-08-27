/**
 * controller.js
 * Central app logic: manages state, rendering, toolbar updates, and persistence.
 */
import { state } from "@app/state";
import { ui, setToolbarEnabled, setActiveToolButton } from "@ui/toolbar";
import { loadPDF } from "@pdf/pdfLoader";
import { renderPage, getIsRendering } from "@pdf/pdfRenderer";
import { renderAnnotationsForPage, setOverlayCursor, syncOverlayToCanvas } from "@ui/overlay";
import { saveState } from "./persistence";
import { undo, redo, historyInit } from "@app/history";

/**
 * Render current page at current zoom.
 */
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

/**
 * Open PDF and reset state.
 */
export async function openFile(file) {
  const { doc, rawData } = await loadPDF(file);
  state.pdfDoc = doc;
  state.loadedPdfData = rawData;
  state.pageNum = 1;
  ui.pageCountEl().textContent = String(state.pdfDoc.numPages);
  await rerender();
  historyInit();   // reset history baseline
  saveState();
}

/**
 * Restore PDF from saved data.
 */
export async function restoreFile() {
  if (!state.loadedPdfData) {
    console.warn("No loaded PDF data to restore.");
    return;
  }
  const { doc } = await loadPDF(new File([state.loadedPdfData], "restored.pdf"));
  state.pdfDoc = doc;
  ui.pageCountEl().textContent = String(state.pdfDoc.numPages);
  await rerender();
  historyInit();   // reset baseline after restore
}

/**
 * Toolbar handlers
 */
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
    const picker = document.getElementById("imagePicker");
    if (picker) picker.click();
  },
  onImageSelected: async (file) => {
    const toDataURL = (f) =>
      new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(f);
      });
    state.pendingImageSrc = await toDataURL(file);
    state.tool = "image";
    setActiveToolButton("image");
    setOverlayCursor("image");
  },
  onUndo: async () => { if (undo()) await rerender(); },
  onRedo: async () => { if (redo()) await rerender(); },
};
