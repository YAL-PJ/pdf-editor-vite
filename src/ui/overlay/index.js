// Barrel exports for overlay utilities + tools

// From layout: keep only what's actually used/shared here
export { setOverlayCursor, clearOverlay } from "./layout";

// Tool initializers
export { initHighlightDrag } from "./highlight";
export { initNotePlacement } from "./notes";
export { initTextDrag } from "./text";
export { initImageDrag } from "./image";

// Rendering + overlay sizing (canonical names live in render.js)
export { renderAnnotationsForPage, syncOverlayToCanvas } from "./render";
