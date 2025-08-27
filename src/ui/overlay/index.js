// Barrel exports for overlay utilities + tools

// From layout: keep commonly used helpers and keep resizeOverlayToCanvas
// exported for compatibility (some modules may still call it).
export { setOverlayCursor, clearOverlay, resizeOverlayToCanvas } from "./layout";

// Tool initializers
export { initHighlightDrag } from "./highlight";
export { initNotePlacement } from "./notes";
export { initTextDrag } from "./text";
export { initImageDrag } from "./image";

// Rendering + overlay sizing (canonical names live in render.js)
export { renderAnnotationsForPage, syncOverlayToCanvas } from "./render";
