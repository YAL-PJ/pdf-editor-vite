/**
 * overlay/image.js
 * Place and resize images on the overlay with aspect-ratio support.
 *
 * UX:
 *  - Click Image tool ➜ pick file (controller sets state.pendingImageSrc)
 *  - Mouse down & drag to size; release to place
 *  - Hold SHIFT while dragging to lock aspect ratio to the image
 *  - Press ESC during drag to cancel
 */
import { state } from "@app/state";
import { saveState } from "@app/persistence";

import { renderAnnotationsForPage } from "./index";

// ---- utils ----
function normalizeRect(px, py, pw, ph, cw, ch) {
  return [px / cw, py / ch, pw / cw, ph / ch];
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function initImageDrag() {
  const layer  = document.getElementById("annoLayer");
  const canvas = document.getElementById("pdfCanvas");
  if (!layer || !canvas) return;

  let startX = 0, startY = 0;
  let preview = null;          // DOM node for live feedback
  let dragging = false;
  let naturalRatio = null;     // width / height of the picked image

  // Convert mouse to local overlay coords
  const local = (evt) => {
    const r = layer.getBoundingClientRect();
    return {
      x: clamp(evt.clientX - r.left, 0, r.width),
      y: clamp(evt.clientY - r.top,  0, r.height),
    };
  };

  // Preload the pending image (if any) to get natural ratio
  async function ensureRatio() {
    if (!state.pendingImageSrc) return null;
    // already known?
    if (naturalRatio && naturalRatio > 0) return naturalRatio;

    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        naturalRatio = img.naturalWidth && img.naturalHeight
          ? img.naturalWidth / img.naturalHeight
          : 1;
        resolve();
      };
      img.onerror = reject;
      img.src = state.pendingImageSrc;
    }).catch(() => { naturalRatio = 1; });

    return naturalRatio || 1;
  }

  function cleanupDrag() {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("keydown", onKey);
    if (preview) { preview.remove(); preview = null; }
  }

  function onKey(e) {
    if (e.key === "Escape") {
      // cancel current placement
      cleanupDrag();
    }
  }

  function onMove(ev) {
    if (!dragging || !preview) return;

    const q = local(ev);
    let x = Math.min(startX, q.x);
    let y = Math.min(startY, q.y);
    let w = Math.abs(q.x - startX);
    let h = Math.abs(q.y - startY);

    // Hold SHIFT to lock aspect ratio
    if (ev.shiftKey && naturalRatio) {
      if (w / Math.max(h, 1) > naturalRatio) {
        // too wide → adjust w based on h
        w = h * naturalRatio;
        x = startX < q.x ? (q.x - w) : startX; // keep anchor side
      } else {
        // too tall → adjust h based on w
        h = w / naturalRatio;
        y = startY < q.y ? (q.y - h) : startY;
      }
    }

    // Clamp inside layer
    const r = layer.getBoundingClientRect();
    w = clamp(w, 8, r.width);
    h = clamp(h, 8, r.height);
    x = clamp(x, 0, r.width - w);
    y = clamp(y, 0, r.height - h);

    Object.assign(preview.style, {
      left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`,
    });
  }

  async function onDown(e) {
    if (state.tool !== "image" || !state.pendingImageSrc) return;

    // Don’t start placement when clicking existing items
    if (e.target.closest(".sticky-note,.text-box,.image-box")) return;

    e.preventDefault();
    await ensureRatio(); // preload to get aspect ratio (non-blocking if cached)

    const p = local(e);
    startX = p.x; startY = p.y;

    // Create a live preview box
    preview = document.createElement("div");
    preview.className = "image-box preview";
    Object.assign(preview.style, { left: `${startX}px`, top: `${startY}px`, width: "1px", height: "1px" });
    // Optional visual cue: background image (comment out if you prefer plain box)
    preview.style.backgroundImage = `url("${state.pendingImageSrc}")`;
    preview.style.backgroundSize  = "contain";
    preview.style.backgroundRepeat = "no-repeat";
    preview.style.backgroundPosition = "center";
    layer.appendChild(preview);

    dragging = true;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onKey);
  }

  function onUp(ev) {
    if (!dragging || !preview) return;

    const r = preview.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    let x = r.left - lr.left;
    let y = r.top  - lr.top;
    let w = r.width;
    let h = r.height;

    cleanupDrag();

    // Ignore tiny placements
    if (w < 8 || h < 8) return;

    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!state.annotations[state.pageNum]) state.annotations[state.pageNum] = [];

    // Save normalized rect + dataURL
    state.annotations[state.pageNum].push({
      type: "image",
      rect: normalizeRect(x, y, w, h, cw, ch),
      src: state.pendingImageSrc,
    });
    saveState();

    // One placement per pick: clear pending source
    state.pendingImageSrc = null;

    // Re-render overlay to show the final image box with drag/resize UX
    renderAnnotationsForPage(state.pageNum);
  }

  layer.addEventListener("mousedown", onDown);
}
