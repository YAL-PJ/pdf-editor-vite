/**
 * overlay/image.js
 * Place and resize images on the overlay with aspect-ratio support.
 */
import { state, markAnnotationsChanged } from "@app/state";
import { saveState } from "@app/persistence";
import { ensureMutablePageAnnotations } from "@app/utils/state";
import { renderAnnotationsForPage } from "./index";
import { historyBegin, historyCommit } from "@app/history";

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
  let preview = null;
  let dragging = false;
  let naturalRatio = null;

  const local = (evt) => {
    const r = layer.getBoundingClientRect();
    return {
      x: clamp(evt.clientX - r.left, 0, r.width),
      y: clamp(evt.clientY - r.top,  0, r.height),
    };
  };

  async function ensureRatio() {
    if (!state.pendingImageSrc) return null;
    if (naturalRatio && naturalRatio > 0) return naturalRatio;
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        naturalRatio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
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

  function onKey(e) { if (e.key === "Escape") cleanupDrag(); }

  function onMove(ev) {
    if (!dragging || !preview) return;
    const q = local(ev);
    let x = Math.min(startX, q.x);
    let y = Math.min(startY, q.y);
    let w = Math.abs(q.x - startX);
    let h = Math.abs(q.y - startY);

    if (ev.shiftKey && naturalRatio) {
      if (w / Math.max(h, 1) > naturalRatio) {
        w = h * naturalRatio;
        x = startX < q.x ? (q.x - w) : startX;
      } else {
        h = w / naturalRatio;
        y = startY < q.y ? (q.y - h) : startY;
      }
    }

    const r = layer.getBoundingClientRect();
    w = clamp(w, 8, r.width);
    h = clamp(h, 8, r.height);
    x = clamp(x, 0, r.width - w);
    y = clamp(y, 0, r.height - h);

    Object.assign(preview.style, {
      left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`
    });
  }

  async function onDown(e) {
    if (state.tool !== "image") return;

    // If no sticky image is picked yet, ask main to open the picker and stop.
    if (!state.pendingImageSrc) {
      document.dispatchEvent(new CustomEvent("annotator:request-image"));
      return;
    }

    if (e.target.closest(".sticky-note,.text-box,.image-box")) return;

    e.preventDefault();
    await ensureRatio();

    const p = local(e);
    startX = p.x; startY = p.y;

    preview = document.createElement("div");
    preview.className = "image-box preview";
    Object.assign(preview.style, {
      left: `${startX}px`,
      top:  `${startY}px`,
      width: "1px",
      height:"1px",
      backgroundImage: `url("${state.pendingImageSrc}")`,
      backgroundSize: "contain",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
    });
    layer.appendChild(preview);

    dragging = true;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onKey);
  }

  function onUp() {
    if (!dragging || !preview) return;

    const r = preview.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    let x = r.left - lr.left;
    let y = r.top  - lr.top;
    let w = r.width;
    let h = r.height;

    cleanupDrag();
    if (w < 8 || h < 8) return;

    const cw = canvas.clientWidth, ch = canvas.clientHeight;

    historyBegin();
  const bucket = ensureMutablePageAnnotations(state.pageNum);
  bucket.push({
    type: "image",
    rect: normalizeRect(x, y, w, h, cw, ch),
    src: state.pendingImageSrc
  });
    markAnnotationsChanged();
    saveState();
    historyCommit();

    // IMPORTANT: keep state.pendingImageSrc to allow sticky multi-placement.
    renderAnnotationsForPage(state.pageNum);
  }

  layer.addEventListener("mousedown", onDown);
}

