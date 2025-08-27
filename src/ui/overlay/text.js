/**
 * overlay/text.js
 * Create and edit text boxes on the overlay.
 */
import { state } from "@app/state";
import { saveState } from "@app/persistence";
import { renderAnnotationsForPage } from "./render";
import { ensureMutablePageAnnotations } from "@app/utils/state";
import { historyBegin, historyCommit } from "@app/history";

// utils
function normalizeRect(px, py, pw, ph, cw, ch) {
  return [px / cw, py / ch, pw / cw, ph / ch];
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function initTextDrag() {
  const layer  = document.getElementById("annoLayer");
  const canvas = document.getElementById("pdfCanvas");
  if (!layer || !canvas) return;

  let startX = 0, startY = 0;
  let preview = null;
  let dragging = false;

  const local = (evt) => {
    const r = layer.getBoundingClientRect();
    return {
      x: clamp(evt.clientX - r.left, 0, r.width),
      y: clamp(evt.clientY - r.top,  0, r.height),
    };
  };

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
    const x = Math.min(startX, q.x);
    const y = Math.min(startY, q.y);
    const w = Math.abs(q.x - startX);
    const h = Math.abs(q.y - startY);

    Object.assign(preview.style, {
      left: `${x}px`,
      top:  `${y}px`,
      width: `${w}px`,
      height:`${h}px`,
    });
  }

  function onUp() {
    if (!dragging || !preview) return;

    const pr = preview.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    let x = pr.left - lr.left;
    let y = pr.top  - lr.top;
    let w = pr.width;
    let h = pr.height;

    cleanupDrag();

    // ignore tiny boxes
    if (w < 10 || h < 10) return;

    const cw = canvas.clientWidth, ch = canvas.clientHeight;

    historyBegin();
    const rectN = normalizeRect(x, y, w, h, cw, ch);
    const ann = {
      type: "text",
      rect: rectN,
      text: "",
      fontSize: Math.max(12, Math.round(h * 0.45)),
      color: "#111",
      align: "left",
    };

    const bucket = ensureMutablePageAnnotations(state.pageNum);
    bucket.push(ann);
    saveState();
    historyCommit();

    renderAnnotationsForPage(state.pageNum);

    // Focus the newly created text box
    const bodies = layer.querySelectorAll(".text-box .text-body");
    if (bodies.length) {
      const body = bodies[bodies.length - 1];
      body.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(body);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function onDown(e) {
    if (state.tool !== "text") return;
    if (e.target.closest(".sticky-note,.text-box,.image-box")) return;

    e.preventDefault();

    const p = local(e);
    startX = p.x; startY = p.y;

    preview = document.createElement("div");
    preview.className = "text-box preview";
    Object.assign(preview.style, {
      left: `${startX}px`,
      top:  `${startY}px`,
      width: "1px",
      height:"1px",
    });
    layer.appendChild(preview);

    dragging = true;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onKey);
  }

  layer.addEventListener("mousedown", onDown);
}
