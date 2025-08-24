/**
 * overlay.js
 * Manages an HTML layer above the canvas for annotations (highlights & notes).
 */
import { state } from "@app/state";

// ---------- Sizing & cursor ----------
export function resizeOverlayToCanvas() {
  const canvas = document.getElementById("pdfCanvas");
  const layer  = document.getElementById("annoLayer");
  const viewer = document.getElementById("viewer");
  if (!canvas || !layer || !viewer) return;

  // Ensure the wrapper can host absolute children
  if (getComputedStyle(viewer).position === "static") {
    viewer.style.position = "relative";
  }

  // Match CSS pixel size of the canvas
  layer.style.position = "absolute";
  layer.style.left = "0";
  layer.style.top  = "0";
  layer.style.width  = `${canvas.clientWidth}px`;
  layer.style.height = `${canvas.clientHeight}px`;
  layer.style.pointerEvents = "auto";
  layer.style.zIndex = "2"; // stay above canvas

  // Canvas should be a positioned element below overlay
  if (getComputedStyle(canvas).position === "static") {
    canvas.style.position = "relative";
    canvas.style.zIndex = "1";
    canvas.style.display = "block";
  }
}

/** Set overlay cursor by tool (called from controller on tool change) */
export function setOverlayCursor(tool) {
  const layer = document.getElementById("annoLayer");
  if (!layer) return;

  switch (tool) {
    case "highlight":
      layer.style.cursor = "crosshair";
      break;
    case "note":
      layer.style.cursor = "pointer";
      break;
    default:
      layer.style.cursor = "default";
  }
}

export function clearOverlay() {
  const layer = document.getElementById("annoLayer");
  if (layer) layer.innerHTML = "";
}

// ---------- Helpers ----------
function makeHighlightPx({ x, y, w, h }) {
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

// Sticky note structure: header (drag + close) + body (editable text)
function makeStickyPx({ x, y, text = "New note..." }) {
  const root   = document.createElement("div");
  const header = document.createElement("div");
  const body   = document.createElement("div");
  const close  = document.createElement("button");

  root.className   = "sticky-note";
  header.className = "note-header";
  body.className   = "note-body";
  close.className  = "note-close-btn";

  // Position
  Object.assign(root.style, { left: `${x}px`, top: `${y}px` });

  // Content/editing
  body.contentEditable = "true";
  body.textContent = text;
  close.textContent = "×";

  header.appendChild(close);
  root.appendChild(header);
  root.appendChild(body);

  return { root, header, body, close };
}

function normalizeRect(px, py, pw, ph, cw, ch) {
  return [px / cw, py / ch, pw / cw, ph / ch];
}
function denormalizeRect(nx, ny, nw, nh, cw, ch) {
  return [nx * cw, ny * ch, nw * cw, nh * ch];
}
function denormalizePoint(nx, ny, cw, ch) {
  return [nx * cw, ny * ch];
}

// ---------- Rendering ----------
export function renderAnnotationsForPage(pageNum) {
  const canvas = document.getElementById("pdfCanvas");
  const layer  = document.getElementById("annoLayer");
  if (!canvas || !layer) return;

  clearOverlay();
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const list = state.annotations[pageNum] || [];

  for (const ann of list) {
    if (ann.type === "highlight") {
      const [x, y, w, h] = denormalizeRect(...ann.rect, cw, ch);
      layer.appendChild(makeHighlightPx({ x, y, w, h }));
    } else if (ann.type === "note") {
      const [x, y] = denormalizePoint(ann.pos[0], ann.pos[1], cw, ch);
      const { root, header, body, close } = makeStickyPx({ x, y, text: ann.text });
      root._annRef = ann;

      // Drag by header only (so body stays editable)
      let startX = 0, startY = 0, originLeft = 0, originTop = 0;
      header.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const rect = root.getBoundingClientRect();
        const layerRect = layer.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        originLeft = rect.left - layerRect.left;
        originTop  = rect.top  - layerRect.top;

        function onMove(ev) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          const newX = Math.max(0, Math.min(originLeft + dx, cw - root.offsetWidth));
          const newY = Math.max(0, Math.min(originTop  + dy, ch - root.offsetHeight));
          root.style.left = `${newX}px`;
          root.style.top  = `${newY}px`;
        }
        function onUp() {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          const nx = parseFloat(root.style.left) / cw;
          const ny = parseFloat(root.style.top)  / ch;
          root._annRef.pos = [nx, ny];
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });

      // Save text on blur
      body.addEventListener("blur", () => {
        root._annRef.text = body.textContent || "";
      });

      // Delete
      close.addEventListener("click", () => {
        const pageList = state.annotations[pageNum];
        const idx = pageList.indexOf(root._annRef);
        if (idx >= 0) pageList.splice(idx, 1);
        root.remove();
      });

      layer.appendChild(root);
    }
  }
}

// ---------- Interactions ----------
export function initHighlightDrag() {
  const layer = document.getElementById("annoLayer");
  const canvas = document.getElementById("pdfCanvas");
  if (!layer || !canvas) return;

  let startX = 0, startY = 0, preview = null;

  const getLocalPos = (evt) => {
    const r = layer.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(evt.clientX - r.left, r.width)),
      y: Math.max(0, Math.min(evt.clientY - r.top, r.height)),
    };
  };

  layer.addEventListener("mousedown", (e) => {
    if (state.tool !== "highlight") return;
    // ignore when clicking on an existing note
    if (e.target.closest(".sticky-note")) return;

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

      // Convert from preview’s CSS rect to canvas-local CSS rect
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
      }
      renderAnnotationsForPage(state.pageNum);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

export function initNotePlacement() {
  const layer = document.getElementById("annoLayer");
  const canvas = document.getElementById("pdfCanvas");
  if (!layer || !canvas) return;

  layer.addEventListener("click", (e) => {
    if (state.tool !== "note") return;
    // don’t drop a new note when clicking inside an existing one
    if (e.target.closest(".sticky-note")) return;

    const r = layer.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
    const y = Math.max(0, Math.min(e.clientY - r.top,  r.height));

    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const nx = x / cw, ny = y / ch;

    if (!state.annotations[state.pageNum]) state.annotations[state.pageNum] = [];
    const model = { type: "note", pos: [nx, ny], text: "New note..." };
    state.annotations[state.pageNum].push(model);

    renderAnnotationsForPage(state.pageNum);
  });
}
