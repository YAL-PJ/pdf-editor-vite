// Barrel exports for overlay utilities + tools

// From layout
export { setOverlayCursor, clearOverlay, resizeOverlayToCanvas } from "./layout";

// Tool initializers
export { initHighlightDrag } from "./highlight";
export { initNotePlacement } from "./notes";
export { initTextDrag } from "./text";
export { initImageDrag } from "./image";
export { initPanScroll, setPannable } from "./pan";

// Rendering
export { renderAnnotationsForPage } from "./render";

// Overlay sizing/alignment
export { syncOverlayToCanvas } from "./sizer";

// (optional) passthrough config so callers can import from "@ui/overlay"
export { updateRenderConfig, renderConfig } from "./config";
