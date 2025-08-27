// notes.js — sticky note helpers + click-to-place + drag + delete
import { state } from "@app/state";
import { saveState } from "@app/persistence";
import { renderAnnotationsForPage } from "./render";

export function denormalizePoint(nx, ny, cw, ch) {
  return [nx * cw, ny * ch];
}

export function makeStickyPx({ x, y, text = "New note..." }) {
  const root   = document.createElement("div");
  const header = document.createElement("div");
  const body   = document.createElement("div");
  const close  = document.createElement("button");

  root.className   = "sticky-note";
  header.className = "note-header";
  body.className   = "note-body";
  close.className  = "note-close-btn";

  Object.assign(root.style, { left: `${x}px`, top: `${y}px` });

  body.contentEditable = "true";
  body.textContent = text;
  close.textContent = "×";

  header.appendChild(close);
  root.appendChild(header);
  root.appendChild(body);

  return { root, header, body, close };
}

export function initNotePlacement() {
  const layer = document.getElementById("annoLayer");
  const canvas = document.getElementById("pdfCanvas");
  if (!layer || !canvas) return;

  layer.addEventListener("click", (e) => {
    if (state.tool !== "note") return;
    if (e.target.closest(".sticky-note")) return;

    const r = layer.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
    const y = Math.max(0, Math.min(e.clientY - r.top,  r.height));

    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const nx = x / cw, ny = y / ch;

    if (!state.annotations[state.pageNum]) state.annotations[state.pageNum] = [];
    state.annotations[state.pageNum].push({ type: "note", pos: [nx, ny], text: "New note..." });
    saveState();

    renderAnnotationsForPage(state.pageNum);
  });
}
