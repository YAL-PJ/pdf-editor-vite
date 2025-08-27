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
} from "@ui/overlay";
import { saveState } from "./persistence";

/**
 * Render current page at current zoom.
 */
export async function rerender() {
  if (!state.pdfDoc) return;
  if (getIsRendering()) return;

  setToolbarEnabled(false);
  try {
    // Render once and grab viewport (pdfRenderer should return it)
    const { viewport } = await renderPage(state.pdfDoc, state.pageNum, state.scale);

    // Keep overlay aligned to canvas
    syncOverlayToCanvas();

    // Save viewport for highlight/note coord mapping
    if (!state.viewports) state.viewports = {};
    state.viewports[state.pageNum] = viewport;

    // Update toolbar labels
    ui.pageNumEl().textContent   = String(state.pageNum);
    ui.zoomLevelEl().textContent = `${Math.round(state.scale * 100)}%`;

    // Rebuild annotations
    renderAnnotationsForPage(state.pageNum, viewport);
  } finally {
    setToolbarEnabled(true);
  }
}

/**
 * Open PDF and reset state.
 * @param {File} file The PDF file to open
 */
export async function openFile(file) {
  const { doc, rawData } = await loadPDF(file);
  state.pdfDoc = doc;
  state.loadedPdfData = rawData; // keep raw bytes for export/restore
  state.pageNum = 1;
  ui.pageCountEl().textContent = String(state.pdfDoc.numPages);
  await rerender();
  saveState();
}

/**
 * Restore the file from saved data in state.
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
    setOverlayCursor(tool || null); // updates #annoLayer[data-tool]
  },

  // ---- Image flow ----
  onPickImage: () => {
    const picker = document.getElementById("imagePicker");
    if (picker) picker.click();
  },

  onImageSelected: async (file) => {
    // Use DataURL for portability (can also use ObjectURL)
    const toDataURL = (f) =>
      new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(f);
      });

    state.pendingImageSrc = await toDataURL(file);
    state.tool = "image";
    setActiveToolButton("image");
    setOverlayCursor("image"); // cursor rule below
  },

  // Wire your existing download handler from main.js
  // onDownloadAnnotated: () => {}
};
