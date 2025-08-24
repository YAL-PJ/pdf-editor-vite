// layout.js — overlay sizing, cursor control, clear helpers
export function resizeOverlayToCanvas() {
  const canvas = document.getElementById("pdfCanvas");
  const layer  = document.getElementById("annoLayer");
  const viewer = document.getElementById("viewer");
  if (!canvas || !layer || !viewer) return;

  if (getComputedStyle(viewer).position === "static") {
    viewer.style.position = "relative";
  }
  layer.style.position = "absolute";
  layer.style.left = "0";
  layer.style.top  = "0";
  layer.style.width  = `${canvas.clientWidth}px`;
  layer.style.height = `${canvas.clientHeight}px`;
  layer.style.pointerEvents = "auto";
  layer.style.zIndex = "2";

  if (getComputedStyle(canvas).position === "static") {
    canvas.style.position = "relative";
    canvas.style.zIndex = "1";
    canvas.style.display = "block";
  }
}

export function setOverlayCursor(tool) {
  const layer = document.getElementById("annoLayer");
  if (!layer) return;
  layer.style.cursor =
    tool === "highlight" ? "crosshair" :
    tool === "note"      ? "pointer"   :
                           "default";
}

export function clearOverlay() {
  const layer = document.getElementById("annoLayer");
  if (layer) layer.innerHTML = "";
}
