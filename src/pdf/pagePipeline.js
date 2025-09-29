/** @typedef {import("pdfjs-dist").PDFPageProxy} PDFPageProxy */

/**
 * Compute the viewport for a page given the available width and current zoom scale.
 * Returns both the viewport and the CSS dimensions required to host it.
 * @param {{ page: PDFPageProxy, containerWidth: number, scale: number }} params
 */
export function measureViewport({ page, containerWidth, scale }) {
  if (!page || typeof page.getViewport !== "function") {
    throw new TypeError("measureViewport: page must be a PDFPageProxy");
  }

  const safeWidth = Math.max(1, containerWidth || 0);
  const baseViewport = page.getViewport({ scale: 1 });
  const fitScale = safeWidth / baseViewport.width;
  const finalScale = fitScale * (scale || 1);
  const viewport = page.getViewport({ scale: finalScale });

  const cssWidth = Math.round(viewport.width);
  const cssHeight = Math.round(viewport.height);

  return {
    viewport,
    cssWidth,
    cssHeight,
    devicePixelRatio: getDevicePixelRatio(),
  };
}

/**
 * Apply the computed viewport dimensions to the canvas element.
 * Ensures layout (CSS) and raster (backing store) sizes stay in sync for crisp output.
 * @param {HTMLCanvasElement} canvas
 * @param {{ cssWidth: number, cssHeight: number, devicePixelRatio: number }} sizing
 */
export function applyViewportToCanvas(canvas, { cssWidth, cssHeight, devicePixelRatio }) {
  if (!canvas) return;
  const dpr = Number.isFinite(devicePixelRatio) ? Math.max(1, devicePixelRatio) : getDevicePixelRatio();
  const width = Math.max(0, cssWidth || 0);
  const height = Math.max(0, cssHeight || 0);

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
}

/**
 * Prepare the rendering context for PDF.js using the provided viewport.
 * @param {HTMLCanvasElement} canvas
 * @param {PDFPageProxy["viewport"]} viewport
 */
export function createRenderParameters(canvas, viewport) {
  if (!canvas || !viewport) {
    return null;
  }
  const context = canvas.getContext("2d", { alpha: false });
  return {
    canvasContext: context,
    viewport,
    intent: "display",
  };
}

export function getDevicePixelRatio() {
  const raw = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.max(1, Math.floor(raw));
}
