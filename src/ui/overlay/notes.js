// notes.js — sticky note helpers + click-to-place + edit + delete
import { state, markAnnotationsChanged } from "@app/state";
import { saveState } from "@app/persistence";
import { renderAnnotationsForPage } from "./render";
import { ensureMutablePageAnnotations } from "@app/utils/state";
import { historyBegin, historyCommit } from "@app/history";

const PLACEHOLDER = "New note…"; // UI-only placeholder (not stored)

/* px <-> normalized helpers (keep for completeness) */
export function denormalizePoint(nx, ny, cw, ch) {
  return [nx * cw, ny * ch];
}

export function makeStickyPx({ x, y, text = "" }) {
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
  // Render text if non-empty; otherwise CSS placeholder will show
  if (text && text !== "New note...") body.textContent = text;
  body.setAttribute("data-placeholder", PLACEHOLDER);

  close.textContent = "×";

  header.appendChild(close);
  root.appendChild(header);
  root.appendChild(body);

  // ---- (Optional) persist edits back into state if your renderer doesn't handle it ----
  const canvas = document.getElementById("pdfCanvas");
  const persistFromDom = () => {
    if (!canvas) return;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const leftPx = parseFloat(root.style.left) || 0;
    const topPx  = parseFloat(root.style.top)  || 0;
    const nx = leftPx / cw;
    const ny = topPx  / ch;

    const bucket = ensureMutablePageAnnotations(state.pageNum) || [];
    // find closest note by position
    let bestIdx = -1, bestDist = Infinity;
    for (let i = 0; i < bucket.length; i++) {
      const ann = bucket[i];
      if (ann?.type !== "note") continue;
      const dx = (ann.pos?.[0] ?? 0) - nx;
      const dy = (ann.pos?.[1] ?? 0) - ny;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestDist) { bestDist = d2; bestIdx = i; }
    }
    if (bestIdx >= 0 && bestDist < 0.02 * 0.02) {
      const t = body.textContent.replace(/\u00A0/g, " ").replace(/\s+$/,"");
      bucket[bestIdx].text = t;
      markAnnotationsChanged();
      saveState();
    }
  };

  // Save on type/blur; clear legacy placeholder when focusing
  body.addEventListener("input", persistFromDom);
  body.addEventListener("blur", persistFromDom);
  body.addEventListener("focus", () => {
    if (body.textContent === "New note...") body.textContent = "";
  });
  body.addEventListener("keydown", (e) => {
    if (e.key === "Escape") body.blur();
  });

  return { root, header, body, close };
}

export function initNotePlacement() {
  const layer = document.getElementById("annoLayer");
  const canvas = document.getElementById("pdfCanvas");
  if (!layer || !canvas) return;

  // When exiting edit with a click, swallow the immediate "create" once
  let suppressNextCreate = false;

  // Handle the "first click" outside while editing (runs before 'click')
  layer.addEventListener("mousedown", (e) => {
    if (state.tool !== "note") return;

    // Interactions with existing overlay elements never create a new note
    if (e.target.closest(".sticky-note,.text-box,.image-box")) return;

    const focused = document.activeElement;
    if (focused?.closest?.(".note-body")) {
      // First outside click: just exit edit, don't create
      focused.blur();
      suppressNextCreate = true;
      e.preventDefault(); // avoid immediate focus shift/select
    }
  });

  // Actual creation path (runs after 'mousedown')
  layer.addEventListener("click", (e) => {
    if (state.tool !== "note") return;

    // If we just exited edit with mousedown, skip creating once
    if (suppressNextCreate) {
      suppressNextCreate = false;
      return;
    }

    // Don't create when clicking other overlay items
    if (e.target.closest(".sticky-note,.text-box,.image-box")) return;

    const r = layer.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
    const y = Math.max(0, Math.min(e.clientY - r.top,  r.height));

    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const nx = x / cw, ny = y / ch;

    const label = `Add note (page ${state.pageNum})`;
    historyBegin(label);
    const bucket = ensureMutablePageAnnotations(state.pageNum);
    // Start empty; CSS placeholder will show, and we'll autofocus it below
    bucket.push({ type: "note", pos: [nx, ny], text: "" });
    markAnnotationsChanged();
    saveState();
    historyCommit(label);

    renderAnnotationsForPage(state.pageNum);

    // Autofocus newly created note for immediate typing
    const bodies = layer.querySelectorAll(".sticky-note .note-body");
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
  });
}
  

