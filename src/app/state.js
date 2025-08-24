/**
 * state.js
 * Centralized app state
 */
export const state = {
  pdfDoc: null,
  pageNum: 1,
  scale: 1.0,

  // Current tool ("highlight" | "note" | null)
  tool: null,

  // Per-page annotations in normalized coords
  // { 1: [ { type: 'highlight', rect:[x,y,w,h] }, ... ] }
  annotations: {},

  // Per-page PDF.js viewports
  viewports: {},
};
