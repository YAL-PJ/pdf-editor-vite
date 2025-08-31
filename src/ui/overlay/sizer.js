// Keeps overlay sized to canvas and observes canvas resizes
export function syncOverlayToCanvas() {
  const canvas = document.getElementById("pdfCanvas");
  const layer  = document.getElementById("annoLayer");
  if (!canvas || !layer) return;
  layer.style.width  = canvas.clientWidth + "px";
  layer.style.height = canvas.clientHeight + "px";
}
window.addEventListener("resize", syncOverlayToCanvas, { passive: true });

let _overlayROInit = false;
export function ensureOverlayObserver() {
  if (_overlayROInit) return;
  const canvas = document.getElementById("pdfCanvas");
  if (!canvas || typeof ResizeObserver === "undefined") return;
  const ro = new ResizeObserver(() => syncOverlayToCanvas());
  ro.observe(canvas);
  _overlayROInit = true;
}
