// File: src/ui/overlay/views/textView.js

import { historyBegin, historyCommit } from "@app/history";
import { replaceAnn, removeAnn } from "../stateOps";
import { clamp, rafThrottle, renderConfig, snapEdge, snapGrid } from "../config";
import { scheduleSave } from "@app/persistence";
import { collectGuides, ensureGuideElems, magneticSnapResize } from "../guides";
import { makeDrag } from "../drag";

const summarizeText = (value = "") => {
  const normalized = String(value)
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  return normalized.length > 50 ? `${normalized.slice(0, 47)}…` : normalized;
};

export function renderText(layer, ann, pageNum, cw, ch) {
  const [nx, ny, nw, nh] = ann.rect;
  const x = nx * cw, y = ny * ch, w = nw * cw, h = nh * ch;

  const box   = document.createElement("div");
  const head  = document.createElement("div");
  const body  = document.createElement("div");
  const close = document.createElement("button");
  const grip  = document.createElement("div");

  box.className   = "text-box";
  head.className  = "text-header";
  body.className  = "text-body";
  close.className = "text-close-btn";
  grip.className  = "text-resize-handle";
  close.textContent = "×";

  Object.assign(box.style, { left:`${x}px`, top:`${y}px`, width:`${w}px`, height:`${h}px` });
  Object.assign(grip.style, {
    position: "absolute", width: "12px", height: "12px",
    right: "-6px", bottom: "-6px", border: "1px solid rgba(0,0,0,0.3)",
    background: "rgba(255,255,255,0.85)", borderRadius: "3px",
    cursor: "nwse-resize", boxShadow: "0 1px 2px rgba(0,0,0,0.15)"
  });

  head.style.touchAction = "none";
  grip.style.touchAction = "none";

  body.contentEditable = "true";
  body.dataset.placeholder = "Type here…";
  body.textContent = ann.text || "";
  body.style.color = ann.color || "#111";
  body.style.textAlign = ann.align || "left";
  body.style.fontSize = `${ann.fontSize || 14}px`;

  box.appendChild(head); box.appendChild(close); box.appendChild(body); box.appendChild(grip);
  layer.appendChild(box);

  let cur = ann;

  // placeholder state
  const updateEmpty = () => {
    const t = (body.textContent || "").trim();
    body.classList.toggle("is-empty", t.length === 0);
  };
  body.addEventListener("input", updateEmpty);
  body.addEventListener("blur", () => {
    const prev = cur.text || "";
    const next = body.textContent || "";
    if (prev !== next) {
      const summary = summarizeText(next);
      const label = summary ? `Update text: "${summary}"` : "Clear text box";
      historyBegin(label);
      cur = replaceAnn(pageNum, cur, { text: next });
      scheduleSave();
      historyCommit(label);
    }
    updateEmpty();
  });
  updateEmpty();

  // drag (header)
  const startTextDrag = makeDrag({
    getSizeAtStart: ()=>({ cw, ch, w: box.offsetWidth, h: box.offsetHeight }),
    getStartLeftTop: ()=>{
      const r=box.getBoundingClientRect(), lr=layer.getBoundingClientRect();
      return { ox: r.left - lr.left, oy: r.top - lr.top };
    },
    applyVisual: (nx,ny,ox,oy)=>{ box.style.willChange="transform"; box.style.transform=`translate(${nx-ox}px, ${ny-oy}px)`; },
    clearVisual: ()=>{ box.style.transform=""; box.style.willChange=""; },
    commit: (fx,fy,CW,CH,started)=>{
      box.style.left=`${fx}px`; box.style.top=`${fy}px`;
      const xN=fx/CW, yN=fy/CH, changed=(xN!==cur.rect[0])||(yN!==cur.rect[1]);
      if (changed && started){ cur = replaceAnn(pageNum, cur, { rect:[xN, yN, cur.rect[2], cur.rect[3]] }); }
      return changed && started;
    },
    pageNum,
    layer,
    excludeAnn: cur,
    historyLabel: () => {
      const summary = summarizeText(cur?.text || "");
      return summary ? `Move text: "${summary}"` : "Move text box";
    },
  });
  head.addEventListener("pointerdown", (e)=>startTextDrag(e, head), { passive: false });

  // resize (handle) — transform-only preview to avoid layout reflow; commit width/height once
  grip.addEventListener("pointerdown", (e) => {
    e.preventDefault();
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
    let resizeLabel = null;

    const ctrl = new AbortController();
    const sig = ctrl.signal;

    const guideUI = ensureGuideElems(layer);
    const guides = renderConfig.snapToGuides ? collectGuides(pageNum, cur, cw, ch) : { xLines: [], yLines: [] };

    const paint = rafThrottle(() => {
      const edgeThr = renderConfig.snapEdgePx, grid = renderConfig.gridPx;
      let w = clamp(curW, renderConfig.minTextW, maxW);
      let h = clamp(curH, renderConfig.minTextH, maxH);

      if (shift) { // dominant axis
        if (Math.abs(w - startW) >= Math.abs(h - startH)) h = startH;
        else w = startW;
      }

      w = snapEdge(w, maxW, edgeThr);
      h = snapEdge(h, maxH, edgeThr);

      let gx = null, gy = null;
      if (renderConfig.snapToGuides && (guides.xLines.length || guides.yLines.length)) {
        const s = magneticSnapResize({ leftPx, topPx, w, h, guides, threshold: edgeThr, useGrid: false, grid });
        w = s.newW; h = s.newH; gx = s.gx; gy = s.gy;
      }

      if (alt) { w = snapGrid(w, grid); h = snapGrid(h, grid); }

      guideUI.show(gx, gy);

      // Transform-only preview: scale from top-left anchor, no layout thrash
      const sx = w / startW;
      const sy = h / startH;
      box.style.transformOrigin = "0 0";
      box.style.transform = `scale(${sx}, ${sy})`;
    });

    const onMove = (ev) => {
      if (ev.pointerId !== pid) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!started && (dx || dy)) {
        const summary = summarizeText(cur?.text || "");
        resizeLabel = summary ? `Resize text: "${summary}"` : "Resize text box";
        historyBegin(resizeLabel);
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
        // Clear transform preview and abort
        box.style.transform = "";
        ctrl.abort();
        return;
      }

      // Calculate final dimensions with all constraints applied
      const edgeThr = renderConfig.snapEdgePx, grid = renderConfig.gridPx;
      let w = clamp(curW, renderConfig.minTextW, maxW);
      let h = clamp(curH, renderConfig.minTextH, maxH);

      if (shift) {
        if (Math.abs(w - startW) >= Math.abs(h - startH)) h = startH;
        else w = startW;
      }

      w = snapEdge(w, maxW, edgeThr);
      h = snapEdge(h, maxH, edgeThr);

      if (renderConfig.snapToGuides && (guides.xLines.length || guides.yLines.length)) {
        const s = magneticSnapResize({ leftPx, topPx, w, h, guides, threshold: edgeThr, useGrid: false, grid });
        w = s.newW; h = s.newH;
      }

      if (alt) { w = snapGrid(w, grid); h = snapGrid(h, grid); }

      const wN = w / cw, hN = h / ch, xN = leftPx / cw, yN = topPx / ch;
      const sizeChanged = (wN !== cur.rect[2]) || (hN !== cur.rect[3]);

      if (sizeChanged) {
        const autoFont = Math.max(10, Math.round(h * 0.45));
        const nextFont = cur.fontSize ?? autoFont;

        cur = replaceAnn(pageNum, cur, { rect:[xN, yN, wN, hN], fontSize: nextFont });

        // Commit real layout ONCE at the end, then clear transform
        box.style.transform = "";
        box.style.width  = `${w}px`;
        box.style.height = `${h}px`;
        body.style.fontSize = `${cur.fontSize}px`;

        scheduleSave();
        historyCommit(resizeLabel);
      } else {
        // No size change, just clear the transform preview
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

  close.addEventListener("click", () => {
    const summary = summarizeText(cur?.text || "");
    const label = summary ? `Delete text: "${summary}"` : "Delete text box";
    historyBegin(label);
    removeAnn(pageNum, cur);
    box.remove();
    scheduleSave();
    historyCommit(label);
  });
}
