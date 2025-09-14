// highlight.js — highlight helpers + drag interaction
import { state, markAnnotationsChanged } from "@app/state";
import { renderAnnotationsForPage } from "./render";
import { saveState } from "@app/persistence";
import { ensureMutablePageAnnotations } from "@app/utils/state";
import { historyBegin, historyCommit } from "@app/history";

// create a positioned highlight element
export function makeHighlightPx({ x, y, w, h }) {
  const el = document.createElement("div");
  el.className = "highlight-box";
  Object.assign(el.style, {
    position: "absolute",
    left: `${x}px`,
    top: `${y}px`,
    width: `${w}px`,
    height: `${h}px`,
  });
  return el;
}

export function normalizeRect(px, py, pw, ph, cw, ch) {
  return [px / cw, py / ch, pw / cw, ph / ch];
}

export function denormalizeRect(nx, ny, nw, nh, cw, ch) {
  return [nx * cw, ny * ch, nw * cw, nh * ch];
}

/** Ensure the annotations root & the current page bucket are mutable */
function ensureMutableAnnotations(pageNum) {
  // If the root object is frozen / non-extensible, replace with a mutable clone
  if (!state.annotations || !Object.isExtensible(state.annotations) || Object.isFrozen(state.annotations)) {
    // structuredClone when available; fallback to JSON clone
    const clone = typeof structuredClone === "function"
      ? structuredClone(state.annotations || {})
      : JSON.parse(JSON.stringify(state.annotations || {}));
    state.annotations = clone;
  }

  // Ensure the page array exists and is mutable
  const bucket = state.annotations[pageNum];
  if (!Array.isArray(bucket)) {
    state.annotations[pageNum] = [];
  } else if (!Object.isExtensible(bucket) || Object.isFrozen(bucket)) {
    state.annotations[pageNum] = bucket.slice(); // shallow mutable copy
  }
}

// drag-to-create interaction
export function initHighlightDrag() {
  const layer = document.getElementById("annoLayer");
  const canvas = document.getElementById("pdfCanvas");
  if (!layer || !canvas) return;

  let startX = 0, startY = 0, preview = null;

  const getLocalPos = (evt) => {
    const r = layer.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(evt.clientX - r.left, r.width)),
      y: Math.max(0, Math.min(evt.clientY - r.top,  r.height)),
    };
  };

  layer.addEventListener("mousedown", (e) => {
    if (state.tool !== "highlight") return;
    if (e.target.closest(".sticky-note")) return; // ignore dragging over notes
    e.preventDefault();

    const p = getLocalPos(e);
    startX = p.x; startY = p.y;

    preview = makeHighlightPx({ x: startX, y: startY, w: 1, h: 1 });
    preview.classList.add("highlight-preview");
    layer.appendChild(preview);

    const onMove = (ev) => {
      const q = getLocalPos(ev);
      const x = Math.min(startX, q.x);
      const y = Math.min(startY, q.y);
      const w = Math.abs(q.x - startX);
      const h = Math.abs(q.y - startY);
      Object.assign(preview.style, { left:`${x}px`, top:`${y}px`, width:`${w}px`, height:`${h}px` });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      const r = preview.getBoundingClientRect();
      preview.remove();

      // convert to layer-local CSS pixels
      const layerRect = layer.getBoundingClientRect();
      const x = r.left - layerRect.left;
      const y = r.top  - layerRect.top;
      const w = r.width;
      const h = r.height;

      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (w > 3 && h > 3) {
        const bucket = ensureMutablePageAnnotations(state.pageNum);
        const rectN = normalizeRect(x, y, w, h, cw, ch);
        historyBegin();
        bucket.push({ type: "highlight", rect: rectN });
        markAnnotationsChanged();
        saveState();
        historyCommit();
      }
      renderAnnotationsForPage(state.pageNum);

    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

