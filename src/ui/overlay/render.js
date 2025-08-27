// render.js — draws annotations by reading state (highlights, notes, text, images)
import { state } from "@app/state";
import { clearOverlay } from "./layout";
import { makeHighlightPx, denormalizeRect } from "./highlight";
import { makeStickyPx, denormalizePoint } from "./notes";

/* Keep overlay sized to the canvas (CSS pixels) */
export function syncOverlayToCanvas() {
  const canvas = document.getElementById("pdfCanvas");
  const layer  = document.getElementById("annoLayer");
  if (!canvas || !layer) return;
  layer.style.width  = canvas.clientWidth + "px";
  layer.style.height = canvas.clientHeight + "px";
}
window.addEventListener("resize", syncOverlayToCanvas);

/* Image box builder (uses CSS background for simplicity) */
function makeImagePx({ x, y, w, h, src }) {
  const el = document.createElement("div");
  el.className = "image-box";
  Object.assign(el.style, {
    left: `${x}px`,
    top: `${y}px`,
    width: `${w}px`,
    height: `${h}px`,
    backgroundImage: `url("${src}")`,
  });
  return el;
}

/**
 * Render all annotations for a page into #annoLayer.
 * - Reads normalized coords from state.annotations[pageNum]
 * - Converts to CSS px using current canvas size
 */
export function renderAnnotationsForPage(pageNum /* , viewport? */) {
  const canvas = document.getElementById("pdfCanvas");
  const layer  = document.getElementById("annoLayer");
  if (!canvas || !layer) return;

  // Ensure overlay matches current canvas box
  syncOverlayToCanvas();

  // Clear previous overlay content
  if (typeof clearOverlay === "function") {
    clearOverlay();
  } else {
    layer.innerHTML = "";
  }

  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const list = state.annotations[pageNum] || [];

  for (const ann of list) {
    if (ann.type === "highlight") {
      // ----- HIGHLIGHT -----
      const [x, y, w, h] = denormalizeRect(...ann.rect, cw, ch);
      layer.appendChild(makeHighlightPx({ x, y, w, h }));

    } else if (ann.type === "note") {
      // ----- NOTE (sticky) -----
      const [x, y] = denormalizePoint(ann.pos[0], ann.pos[1], cw, ch);
      const { root, header, body, close } = makeStickyPx({ x, y, text: ann.text });
      root._annRef = ann;

      // Drag by header
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

      // Text save + delete
      body.addEventListener("blur", () => {
        root._annRef.text = body.textContent || "";
      });
      close.addEventListener("click", () => {
        const pageList = state.annotations[pageNum];
        const idx = pageList.indexOf(root._annRef);
        if (idx >= 0) pageList.splice(idx, 1);
        root.remove();
      });

      layer.appendChild(root);

    } else if (ann.type === "text") {
      // ----- TEXT BOX -----
      const [nx, ny, nw, nh] = ann.rect;
      let x = nx * cw, y = ny * ch, w = nw * cw, h = nh * ch;

      const box   = document.createElement("div");
      const head  = document.createElement("div");
      const body  = document.createElement("div");
      const close = document.createElement("button");

      box.className   = "text-box";
      head.className  = "text-header";
      body.className  = "text-body";
      close.className = "text-close-btn";
      close.textContent = "×";

      Object.assign(box.style, { left:`${x}px`, top:`${y}px`, width:`${w}px`, height:`${h}px` });

      // Editable body + placeholder
      body.contentEditable = "true";
      body.dataset.placeholder = "Type here…";
      body.textContent = ann.text || "";
      body.style.color = ann.color || "#111";
      body.style.textAlign = ann.align || "left";
      body.style.fontSize = `${ann.fontSize || 14}px`;

      // Assemble
      box.appendChild(head);
      box.appendChild(close);
      box.appendChild(body);
      layer.appendChild(box);

      // Empty-state placeholder
      const updateEmpty = () => {
        const t = (body.textContent || "").trim();
        body.classList.toggle("is-empty", t.length === 0);
      };
      body.addEventListener("input", () => {
        ann.text = body.textContent || "";
        updateEmpty();
      });
      body.addEventListener("blur", () => {
        ann.text = body.textContent || "";
        updateEmpty();
      });
      updateEmpty();

      // Drag by header
      let sx=0, sy=0, ox=0, oy=0;
      head.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const r  = box.getBoundingClientRect();
        const lr = layer.getBoundingClientRect();
        sx = e.clientX; sy = e.clientY;
        ox = r.left - lr.left; oy = r.top - lr.top;

        const move = (ev) => {
          const nxp = Math.max(0, Math.min(ox + (ev.clientX - sx), cw - box.offsetWidth));
          const nyp = Math.max(0, Math.min(oy + (ev.clientY - sy), ch - box.offsetHeight));
          box.style.left = `${nxp}px`;
          box.style.top  = `${nyp}px`;
        };
        const up = () => {
          document.removeEventListener("mousemove", move);
          document.removeEventListener("mouseup", up);
          const xN = parseFloat(box.style.left)/cw;
          const yN = parseFloat(box.style.top)/ch;
          ann.rect = [xN, yN, ann.rect[2], ann.rect[3]];
        };
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
      });

      // Persist size on mouseup
      box.addEventListener("mouseup", () => {
        const wN = box.offsetWidth  / cw;
        const hN = box.offsetHeight / ch;
        const xN = parseFloat(box.style.left)/cw;
        const yN = parseFloat(box.style.top) /ch;
        ann.rect = [xN, yN, wN, hN];

        const autoFont = Math.max(10, Math.round(box.offsetHeight * 0.45));
        ann.fontSize = ann.fontSize || autoFont;
        body.style.fontSize = `${ann.fontSize}px`;
      });

      // Delete
      close.addEventListener("click", () => {
        const pageList = state.annotations[pageNum];
        const idx = pageList.indexOf(ann);
        if (idx >= 0) pageList.splice(idx, 1);
        box.remove();
      });

    } else if (ann.type === "image") {
      // ----- IMAGE -----
      const [x, y, w, h] = denormalizeRect(...ann.rect, cw, ch);
      layer.appendChild(makeImagePx({ x, y, w, h, src: ann.src }));
    }
  }
}
