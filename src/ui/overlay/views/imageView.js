import { makeDrag } from "../drag";
import { replaceAnn } from "../stateOps";
import { historyBegin, historyCommit } from "@app/history";
import { scheduleSave } from "@app/persistence";
import { clamp, rafThrottle, renderConfig, snapEdge, snapGrid } from "../config";
import { collectGuides, ensureGuideElems, magneticSnapResize } from "../guides";

function makeImagePx({ x, y, w, h, src }) {
  const el = document.createElement("div");
  el.className = "image-box";
  Object.assign(el.style, {
    left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`,
    backgroundImage: `url("${src}")`, backgroundSize: "cover",
    backgroundPosition: "center", backgroundRepeat: "no-repeat",
  });
  return el;
}

export function renderImage(layer, ann, pageNum, cw, ch) {
  const [nx, ny, nw, nh] = ann.rect;
  const x = nx * cw, y = ny * ch, w = nw * cw, h = nh * ch;
  const box = makeImagePx({ x, y, w, h, src: ann.src });
  box._annRef = ann;
  box.style.touchAction = "none";

  // Drag to move the image box (avoid conflicting with native CSS resize handle)
  const startImageDrag = makeDrag({
    getSizeAtStart: () => ({ cw, ch, w: box.offsetWidth, h: box.offsetHeight }),
    getStartLeftTop: () => {
      const r = box.getBoundingClientRect();
      const lr = layer.getBoundingClientRect();
      return { ox: r.left - lr.left, oy: r.top - lr.top };
    },
    applyVisual: (nx, ny, ox, oy) => {
      box.style.willChange = "transform";
      box.style.transform = `translate(${nx - ox}px, ${ny - oy}px)`;
    },
    clearVisual: () => { box.style.transform = ""; box.style.willChange = ""; },
    commit: (fx, fy, CW, CH, started) => {
      box.style.left = `${fx}px`; box.style.top = `${fy}px`;
      const prev = box._annRef.rect || [0,0,0,0];
      const nx = fx / CW, ny = fy / CH;
      const changed = (nx !== prev[0]) || (ny !== prev[1]);
      box._annRef = replaceAnn(pageNum, box._annRef, { rect: [nx, ny, prev[2], prev[3]] });
      return changed && started;
    },
    pageNum, layer, excludeAnn: ann,
  });
  box.addEventListener("pointerdown", (e) => {
    // If the pointer starts near the bottom-right corner, let native resize run
    const rect = box.getBoundingClientRect();
    const M = 18; // px margin treated as resize area
    const nearRight = e.clientX >= rect.right - M;
    const nearBottom = e.clientY >= rect.bottom - M;
    if (nearRight && nearBottom) return; // do not hijack resize corner

    startImageDrag(e, box);
  }, { passive: false });

  // Persist size changes after a native CSS resize ends (on pointerup)
  box.addEventListener("pointerup", () => {
    try {
      const CW = cw, CH = ch;
      const prev = box._annRef.rect || [0,0,0,0];
      const wN = (box.offsetWidth  || 0) / CW;
      const hN = (box.offsetHeight || 0) / CH;
      if (wN && hN && (wN !== prev[2] || hN !== prev[3])) {
        box._annRef = replaceAnn(pageNum, box._annRef, { rect: [prev[0], prev[1], wN, hN] });
      }
    } catch {}
  });

  // Custom resize handle (top-left anchored scale preview + guided snapping)
  const grip  = document.createElement("div");
  grip.className = "image-resize-handle";
  Object.assign(grip.style, {
    position: "absolute", width: "12px", height: "12px",
    right: "-6px", bottom: "-6px", border: "1px solid rgba(0,0,0,0.3)",
    background: "rgba(255,255,255,0.85)", borderRadius: "3px",
    cursor: "nwse-resize", boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
    zIndex: 10,
  });
  box.appendChild(grip);

  grip.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const pid = e.pointerId;
    grip.setPointerCapture?.(pid);

    const startX = e.clientX, startY = e.clientY;
    const startW = box.offsetWidth, startH = box.offsetHeight;
    const leftPx = parseFloat(box.style.left) || 0;
    const topPx  = parseFloat(box.style.top)  || 0;
    const maxW = Math.max(renderConfig.minTextW, cw - leftPx);
    const maxH = Math.max(renderConfig.minTextH, ch - topPx);
    let started = false;
    let curW = startW, curH = startH;
    let shift = e.shiftKey, alt = e.altKey;

    const ctrl = new AbortController();
    const sig = ctrl.signal;

    const guideUI = ensureGuideElems(layer);
    const guides = renderConfig.snapToGuides ? collectGuides(pageNum, box._annRef, cw, ch) : { xLines: [], yLines: [] };

    const paint = rafThrottle(() => {
      const edgeThr = renderConfig.snapEdgePx, grid = renderConfig.gridPx;
      let w2 = clamp(curW, renderConfig.minTextW, maxW);
      let h2 = clamp(curH, renderConfig.minTextH, maxH);

      if (shift) {
        // Dominant axis lock
        if (Math.abs(w2 - startW) >= Math.abs(h2 - startH)) h2 = startH;
        else w2 = startW;
      }

      w2 = snapEdge(w2, maxW, edgeThr);
      h2 = snapEdge(h2, maxH, edgeThr);

      let gx = null, gy = null;
      if (renderConfig.snapToGuides && (guides.xLines.length || guides.yLines.length)) {
        const s = magneticSnapResize({ leftPx, topPx, w: w2, h: h2, guides, threshold: edgeThr, useGrid: false, grid });
        w2 = s.newW; h2 = s.newH; gx = s.gx; gy = s.gy;
      }

      if (alt) { w2 = snapGrid(w2, grid); h2 = snapGrid(h2, grid); }

      guideUI.show(gx, gy);

      // Transform-only preview: scale from top-left anchor, no layout thrash
      const sx = w2 / startW;
      const sy = h2 / startH;
      box.style.transformOrigin = "0 0";
      box.style.transform = `scale(${sx}, ${sy})`;
    });

    const onMove = (ev) => {
      if (ev.pointerId !== pid) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!started && (dx || dy)) {
        historyBegin();
        started = true;
        document.body.style.userSelect = "none";
      }
      curW = startW + dx;
      curH = startH + dy;
      paint();
    };

    const finish = (cancelled = false) => {
      try { grip.releasePointerCapture?.(pid); } catch {}
      document.body.style.userSelect = "";
      guideUI.clear();

      if (cancelled) {
        box.style.transform = "";
        ctrl.abort();
        return;
      }

      const edgeThr = renderConfig.snapEdgePx, grid = renderConfig.gridPx;
      let w2 = clamp(curW, renderConfig.minTextW, maxW);
      let h2 = clamp(curH, renderConfig.minTextH, maxH);

      if (shift) {
        if (Math.abs(w2 - startW) >= Math.abs(h2 - startH)) h2 = startH;
        else w2 = startW;
      }
      w2 = snapEdge(w2, maxW, edgeThr);
      h2 = snapEdge(h2, maxH, edgeThr);

      if (renderConfig.snapToGuides && (guides.xLines.length || guides.yLines.length)) {
        const s = magneticSnapResize({ leftPx, topPx, w: w2, h: h2, guides, threshold: edgeThr, useGrid: false, grid });
        w2 = s.newW; h2 = s.newH;
      }

      if (alt) { w2 = snapGrid(w2, grid); h2 = snapGrid(h2, grid); }

      const wN = w2 / cw, hN = h2 / ch;
      const prev = box._annRef.rect || [0,0,0,0];
      const changed = (wN !== prev[2]) || (hN !== prev[3]);

      if (changed) {
        box._annRef = replaceAnn(pageNum, box._annRef, { rect: [prev[0], prev[1], wN, hN] });
        // Commit real layout ONCE at the end, then clear transform
        box.style.transform = "";
        box.style.width  = `${w2}px`;
        box.style.height = `${h2}px`;
        scheduleSave();
        historyCommit();
      } else {
        box.style.transform = "";
      }

      ctrl.abort();
    };

    const onUp = (ev) => { if (ev.pointerId !== pid) return; finish(false); };
    const onCancel = (ev) => { if (ev.pointerId !== pid) return; finish(true); };

    window.addEventListener("pointermove", onMove,   { signal: sig });
    window.addEventListener("pointerup",   onUp,     { signal: sig });
    window.addEventListener("pointercancel", onCancel, { signal: sig });
  }, { passive: false });

  layer.appendChild(box);
}
