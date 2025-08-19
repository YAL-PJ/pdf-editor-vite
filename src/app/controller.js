/**
 * controller.js
 * Purpose: Orchestrate state updates, rendering, and UI text.
 * Why: Keeps business logic separate from DOM creation.
 */
import { state } from "./app/state";
import { ui } from "@ui/toolbar";
import { loadPDF } from "./pdf/pdfLoader";
import { renderPage } from "./pdf/pdfRenderer";

/** Re-render current page and update small UI labels */
export async function rerender() {
  if (!state.pdfDoc) return;
  await renderPage(state.pdfDoc, state.pageNum, state.scale);
  ui.pageNumEl().textContent   = String(state.pageNum);
  ui.zoomLevelEl().textContent = `${Math.round(state.scale * 100)}%`;
}

/** Open a newly selected file and show page 1 */
export async function openFile(file) {
  state.pdfDoc = await loadPDF(file);
  state.pageNum = 1;
  ui.pageCountEl().textContent = String(state.pdfDoc.numPages);
  await rerender();
}

/** Button handlers (passed to toolbar) */
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
    state.scale = Math.min(state.scale + 0.1, 3.0); // cap at 300%
    await rerender();
  },
  onZoomOut: async () => {
    if (!state.pdfDoc) return;
    state.scale = Math.max(state.scale - 0.1, 0.3); // min 30%
    await rerender();
  },
};

