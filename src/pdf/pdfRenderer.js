/**
 * pdfRenderer.js
 * Purpose: Render a PDF page to the #pdfCanvas safely (no overlapping renders),
 *          scale for HiDPI (retina) displays, and keep the annotation overlay
 *          in sync with the canvas size.
 */
import { syncOverlayToCanvas, renderAnnotationsForPage } from "@ui/overlay";
import { state } from "@app/state";

let activeTask = null;   // current PDF.js RenderTask
let isRendering = false; // flag so controller can guard re-entries

export function getIsRendering() {
  return isRendering;
}

/**
 * Render a page into the #pdfCanvas.
 * @param {PDFDocumentProxy} pdfDoc - PDF.js document
 * @param {number} pageNum - 1-based page index
 * @param {number} scale   - zoom factor (1.0 = 100%)
 * @returns {Promise<{width:number,height:number}>}
 */
export async function renderPage(pdfDoc, pageNum = 1, scale = 1.0) {
  const page = await pdfDoc.getPage(pageNum);

  // Compute viewport at requested scale
  const viewport = page.getViewport({ scale });

  // Canvas + 2D context
  const canvas = document.getElementById("pdfCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  // HiDPI scaling for crisp rendering on retina screens
  const dpr = window.devicePixelRatio || 1;
  const cssWidth  = Math.ceil(viewport.width);
  const cssHeight = Math.ceil(viewport.height);

  // Set canvas backing store size in device pixels …
  canvas.width  = Math.max(1, Math.floor(cssWidth  * dpr));
  canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
  // …but keep CSS size in CSS pixels so layout is correct
  canvas.style.width  = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  // Reset transform then scale drawing operations for DPR
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  // If a previous render is in flight, cancel it and wait for cleanup
  if (activeTask) {
    try {
      activeTask.cancel();
      await activeTask.promise; // will reject; that's expected after cancel()
    } catch {
      /* ignore cancellation rejection */
    }
    activeTask = null;
  }

  // Render the page (the ONLY render allowed at a time)
  isRendering = true;
  try {
    activeTask = page.render({ canvasContext: ctx, viewport });
    await activeTask.promise;
  } finally {
    activeTask = null;
    isRendering = false;
  }

// Keep the annotation overlay aligned to the canvas size/position
syncOverlayToCanvas();

// Repaint annotations for the current page
renderAnnotationsForPage(state.pageNum);

// Return the CSS pixel size that the rest of the UI can use
return { viewport, width: cssWidth, height: cssHeight };
}
