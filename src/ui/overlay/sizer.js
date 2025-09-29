// Keeps overlay sized to canvas and observes canvas resizes
export function syncOverlayToCanvas() {
  const canvas = document.getElementById("pdfCanvas");
  const layer  = document.getElementById("annoLayer");
  const text   = document.getElementById("textLayer");
  if (!canvas) return;
  const width  = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (layer) {
    layer.style.width  = width + "px";
    layer.style.height = height + "px";
  }
  if (text) {
    text.style.width  = width + "px";
    text.style.height = height + "px";
  }
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
