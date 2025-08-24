// render.js — draws annotations by reading state (highlights + notes)
import { state } from "@app/state";
import { clearOverlay } from "./layout";
import { makeHighlightPx, denormalizeRect } from "./highlight";
import { makeStickyPx, denormalizePoint } from "./notes";

export function renderAnnotationsForPage(pageNum /*, viewport? */) {
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

      // drag by header
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

      // text save + delete
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
    }
  }
}
