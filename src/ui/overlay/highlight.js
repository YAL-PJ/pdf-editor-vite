// highlight.js — highlight helpers + drag interaction
import { state } from "@app/state";
import { renderAnnotationsForPage } from "./render";
import { saveState } from "@app/persistence";

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
        if (!state.annotations[state.pageNum]) state.annotations[state.pageNum] = [];
        const rectN = normalizeRect(x, y, w, h, cw, ch);
        state.annotations[state.pageNum].push({ type: "highlight", rect: rectN });
        saveState();
      }
      renderAnnotationsForPage(state.pageNum);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}
