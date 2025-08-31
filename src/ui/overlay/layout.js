// layout.js — overlay sizing, cursor control, clear helpers

// NOTE: This function is kept for compatibility. Most callers now use
// syncOverlayToCanvas() from sizer.js, which mirrors this logic.
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

// Use data-tool to drive cursor via CSS (viewer.css)
// Example rules:
//  #annoLayer[data-tool="highlight"] { cursor: crosshair; }
//  #annoLayer[data-tool="note"]      { cursor: copy; }
//  #annoLayer[data-tool="text"]      { cursor: text; }
//  #annoLayer[data-tool="image"]     { cursor: crosshair; }
export function setOverlayCursor(tool) {
  const layer = document.getElementById("annoLayer");
  if (!layer) return;
  if (tool) {
    layer.setAttribute("data-tool", tool);
  } else {
    layer.removeAttribute("data-tool");
  }
}

export function clearOverlay() {
  const layer = document.getElementById("annoLayer");
  if (layer) layer.innerHTML = "";
}
