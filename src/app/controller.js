/**
 * controller.js
 * Central app logic: manages state, rendering, toolbar updates.
 */
import { state } from "@app/state";
import { ui, setToolbarEnabled, setActiveToolButton } from "@ui/toolbar";
import { loadPDF } from "@pdf/pdfLoader";
import { renderPage, getIsRendering } from "@pdf/pdfRenderer";
import { renderAnnotationsForPage, setOverlayCursor } from "@ui/overlay";

/**
 * Render current page at current zoom.
 */
export async function rerender() {
  if (!state.pdfDoc) return;
  if (getIsRendering()) return;

  setToolbarEnabled(false);
  try {
    // Render once and grab viewport
    const { viewport } = await renderPage(state.pdfDoc, state.pageNum, state.scale);

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
 */
export async function openFile(file) {
  state.pdfDoc = await loadPDF(file);
  state.pageNum = 1;
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
    state.tool = tool;                   // "highlight" | "note" | null
    setActiveToolButton(tool);           // visual state
    setOverlayCursor(tool);              // cursor feedback
  },
};
