// Barrel exports for overlay utilities + tools

// From layout
export { setOverlayCursor, clearOverlay, resizeOverlayToCanvas } from "./layout";

// Tool initializers
export { initHighlightDrag } from "./highlight";
export { initNotePlacement } from "./notes";
export { initTextDrag } from "./text";
export { initImageDrag } from "./image";

// Rendering + sizing
export { renderAnnotationsForPage } from "./render";
export { syncOverlayToCanvas } from "./sizer";   // ⬅️ moved here

// (optional) passthrough config so callers can import from "@ui/overlay"
export { updateRenderConfig, renderConfig } from "./config";
