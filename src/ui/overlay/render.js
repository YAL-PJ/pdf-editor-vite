// render.js — draws annotations by reading state (highlights, notes, text, images)
import { state } from "@app/state";
import { clearOverlay } from "./layout";
import { makeHighlightPx, denormalizeRect } from "./highlight";
import { makeStickyPx, denormalizePoint } from "./notes";
import { saveState } from "@app/persistence";
import { historyBegin, historyCommit } from "@app/history";

/* ---------- config (tweak at runtime via updateRenderConfig) ---------- */
export const renderConfig = {
  snapEdgePx: 8,     // edge snap distance (px)
  gridPx: 16,        // grid size (Alt to enable while dragging)
  minTextW: 60,
  minTextH: 32,
  snapToGuides: true // magnetic snap to other annotations
};
export function updateRenderConfig(patch = {}) {
  Object.assign(renderConfig, patch);
}

/* ---------- utils ---------- */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rafThrottle = (fn) => { let id = 0, args = null; return (...a) => { args = a; if (id) return; id = requestAnimationFrame(() => { id = 0; fn(...args); }); }; };
const scheduleSave = (() => { let t; return (immediate = false) => { clearTimeout(t); if (immediate) return saveState(); t = setTimeout(() => saveState(), 250); }; })();

const snapEdge = (val, max, thr) => (Math.abs(val - 0) <= thr ? 0 : Math.abs(max - val) <= thr ? max : val);
const snapGrid = (val, grid) => Math.round(val / grid) * grid;

/* ---------- guides (magnetic snapping to other elements) ---------- */
function collectGuides(pageNum, excludeAnn, cw, ch) {
  const list = getPageList(pageNum);
  const xLines = []; // px
  const yLines = [];
  for (const ann of list) {
    if (ann === excludeAnn) continue;
    if (ann.type === "text" || ann.type === "image" || ann.type === "highlight") {
      const [nx, ny, nw, nh] = ann.rect;
      const x = nx * cw, y = ny * ch, w = nw * cw, h = nh * ch;
      xLines.push(x, x + w, x + w / 2);
      yLines.push(y, y + h, y + h / 2);
    } else if (ann.type === "note") {
      const [px, py] = ann.pos || [0, 0];
      xLines.push(px * cw);
      yLines.push(py * ch);
    }
  }
  // Dedup-ish (round to 0.5 px buckets)
  const uniq = (arr) => {
    const seen = new Set();
    const out = [];
    for (const v of arr) {
      const k = Math.round(v * 2) / 2;
      if (!seen.has(k)) { seen.add(k); out.push(v); }
    }
    return out;
  };
  return { xLines: uniq(xLines), yLines: uniq(yLines) };
}

function ensureGuideElems(layer) {
  let gx = layer.querySelector(".guide-x");
  let gy = layer.querySelector(".guide-y");
  if (!gx) {
    gx = document.createElement("div");
    gx.className = "guide-x";
    Object.assign(gx.style, {
      position: "absolute", top: "0", width: "1px", height: "100%",
      background: "rgba(46,170,220,0.8)", pointerEvents: "none", transform: "translateX(-0.5px)", display: "none", zIndex: 9999
    });
    layer.appendChild(gx);
  }
  if (!gy) {
    gy = document.createElement("div");
    gy.className = "guide-y";
    Object.assign(gy.style, {
      position: "absolute", left: "0", width: "100%", height: "1px",
      background: "rgba(46,170,220,0.8)", pointerEvents: "none", transform: "translateY(-0.5px)", display: "none", zIndex: 9999
    });
    layer.appendChild(gy);
  }
  return {
    show(x, y) {
      if (typeof x === "number") { gx.style.left = `${x}px`; gx.style.display = "block"; } else gx.style.display = "none";
      if (typeof y === "number") { gy.style.top  = `${y}px`; gy.style.display = "block"; } else gy.style.display = "none";
    },
    clear() { gx.style.display = "none"; gy.style.display = "none"; }
  };
}

function magneticSnapMove({ rx, ry, size, guides, threshold, useGrid, grid }) {
  // Snap box’s left/right/center to nearest x guide; top/bottom/center to nearest y guide
  let snapX = null, snapY = null;
  let bestDx = Infinity, bestDy = Infinity;

  const left = rx, right = rx + size.w, cx = rx + size.w / 2;
  for (const line of guides.xLines) {
    const dL = Math.abs(line - left);
    const dR = Math.abs(line - right);
    const dC = Math.abs(line - cx);
    const d = Math.min(dL, dR, dC);
    if (d <= threshold && d < bestDx) {
      bestDx = d;
      // choose which edge matched
      if (d === dL) snapX = line - (left - rx);
      else if (d === dR) snapX = line - (right - rx);
      else snapX = line - (cx - rx);
    }
  }

  const top = ry, bottom = ry + size.h, cy = ry + size.h / 2;
  for (const line of guides.yLines) {
    const dT = Math.abs(line - top);
    const dB = Math.abs(line - bottom);
    const dC = Math.abs(line - cy);
    const d = Math.min(dT, dB, dC);
    if (d <= threshold && d < bestDy) {
      bestDy = d;
      if (d === dT) snapY = line - (top - ry);
      else if (d === dB) snapY = line - (bottom - ry);
      else snapY = line - (cy - ry);
    }
  }

  // Optional grid after magnetic (so magnets “win”, grid is secondary)
  let nx = snapX ?? rx;
  let ny = snapY ?? ry;
  if (useGrid) {
    nx = snapGrid(nx, grid);
    ny = snapGrid(ny, grid);
  }
  return { nx, ny, gx: snapX != null ? (snapX + 0) : null, gy: snapY != null ? (snapY + 0) : null };
}

function magneticSnapResize({ leftPx, topPx, w, h, guides, threshold, useGrid, grid }) {
  // Snap right/bottom edges to guides
  let snapRight = null, snapBottom = null;
  let bestDx = Infinity, bestDy = Infinity;

  const right = leftPx + w, bottom = topPx + h;
  for (const line of guides.xLines) {
    const d = Math.abs(line - right);
    if (d <= threshold && d < bestDx) { bestDx = d; snapRight = line; }
  }
  for (const line of guides.yLines) {
    const d = Math.abs(line - bottom);
    if (d <= threshold && d < bestDy) { bestDy = d; snapBottom = line; }
  }

  let newW = snapRight != null ? (snapRight - leftPx) : w;
  let newH = snapBottom != null ? (snapBottom - topPx) : h;

  if (useGrid) {
    newW = snapGrid(newW, grid);
    newH = snapGrid(newH, grid);
  }
  return { newW, newH, gx: snapRight, gy: snapBottom };
}

/* ---------- pointer drag helper with guides, snapping & keyboard modifiers ---------- */
function makeDrag(opts){
  const { getStartLeftTop, getSizeAtStart, applyVisual, clearVisual, commit, pageNum, layer, excludeAnn } = opts;
  const throttle = (fn)=>{ let id=0,a=null; return (...x)=>{ a=x; if(id) return; id=requestAnimationFrame(()=>{ id=0; fn(...a); }); }; };
  let sx=0, sy=0, ox=0, oy=0, dx=0, dy=0, started=false, size={cw:0,ch:0,w:0,h:0}, pid=null, ctrl=null, captureEl=null;
  let shift=false, alt=false;

  const guideUI = ensureGuideElems(layer);
  let guides = { xLines: [], yLines: [] };

  const paint = throttle(() => {
    const edgeThr = renderConfig.snapEdgePx;
    const grid = renderConfig.gridPx;

    // candidate position with axis constrain
    let rx = ox + dx, ry = oy + dy;
    if (shift) { if (Math.abs(dx) >= Math.abs(dy)) ry = oy; else rx = ox; }

    // clamp
    rx = clamp(rx, 0, size.cw - size.w);
    ry = clamp(ry, 0, size.ch - size.h);

    // snap to container edges
    rx = snapEdge(rx, size.cw - size.w, edgeThr);
    ry = snapEdge(ry, size.ch - size.h, edgeThr);

    // magnetic guides
    let gx = null, gy = null;
    if (renderConfig.snapToGuides && (guides.xLines.length || guides.yLines.length)) {
      const s = magneticSnapMove({ rx, ry, size, guides, threshold: edgeThr, useGrid: false, grid });
      rx = s.nx; ry = s.ny; gx = s.gx; gy = s.gy;
    }

    // optional grid (Alt)
    if (alt) { rx = snapGrid(rx, grid); ry = snapGrid(ry, grid); }

    // draw
    guideUI.show(gx, gy);
    applyVisual(rx, ry, ox, oy);
  });

  const onMove = (e) => {
    if (e.pointerId !== pid) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if (!started && (dx || dy)) { historyBegin(); started = true; document.body.style.userSelect = "none"; }
    paint();
  };

  const finish = (cancelled=false) => {
    try { captureEl?.releasePointerCapture?.(pid); } catch {}
    document.body.style.userSelect = "";
    guideUI.clear();
    clearVisual();

    // final position with same rules as paint
    const edgeThr = renderConfig.snapEdgePx;
    const grid = renderConfig.gridPx;
    let fx = ox + dx, fy = oy + dy;
    if (shift) { if (Math.abs(dx) >= Math.abs(dy)) fy = oy; else fx = ox; }
    fx = clamp(fx, 0, size.cw - size.w);
    fy = clamp(fy, 0, size.ch - size.h);
    fx = snapEdge(fx, size.cw - size.w, edgeThr);
    fy = snapEdge(fy, size.ch - size.h, edgeThr);
    if (renderConfig.snapToGuides && (guides.xLines.length || guides.yLines.length)) {
      const s = magneticSnapMove({ rx: fx, ry: fy, size, guides, threshold: edgeThr, useGrid: false, grid });
      fx = s.nx; fy = s.ny;
    }
    if (alt) { fx = snapGrid(fx, grid); fy = snapGrid(fy, grid); }

    const changed = !cancelled && commit(fx, fy, size.cw, size.ch, started);
    if (changed && started){ scheduleSave(); historyCommit(); }
    ctrl?.abort();
  };

  const onUp = (e) => { if (e.pointerId !== pid) return; finish(false); };
  const onCancel = (e) => { if (e.pointerId !== pid) return; finish(true); };
  const onKey = (e) => {
    if (e.key === "Shift") { shift = e.type === "keydown"; paint(); }
    else if (e.key === "Alt") { alt = e.type === "keydown"; paint(); }
    else if (e.key === "Escape" && e.type === "keydown") { finish(true); }
  };

  return function start(e, elForCapture){
    e.preventDefault();
    pid = e.pointerId; captureEl = elForCapture || e.currentTarget;
    ({ ox, oy } = getStartLeftTop());
    size = getSizeAtStart();
    sx = e.clientX; sy = e.clientY; dx = dy = 0; started = false;
    shift = e.shiftKey; alt = e.altKey;

    // build guides once per interaction
    guides = renderConfig.snapToGuides ? collectGuides(pageNum, excludeAnn, size.cw, size.ch) : { xLines: [], yLines: [] };

    ctrl = new AbortController();
    const sig = ctrl.signal;
    window.addEventListener("pointermove", onMove,     { signal: sig });
    window.addEventListener("pointerup", onUp,         { signal: sig });
    window.addEventListener("pointercancel", onCancel, { signal: sig });
    window.addEventListener("keydown", onKey,          { signal: sig });
    window.addEventListener("keyup", onKey,            { signal: sig });

    captureEl?.setPointerCapture?.(pid);
  };
}

/* ---------- overlay sizing ---------- */
export function syncOverlayToCanvas() {
  const canvas = document.getElementById("pdfCanvas");
  const layer  = document.getElementById("annoLayer");
  if (!canvas || !layer) return;
  layer.style.width  = canvas.clientWidth + "px";
  layer.style.height = canvas.clientHeight + "px";
}
window.addEventListener("resize", syncOverlayToCanvas, { passive: true });

let _overlayROInit = false;
function ensureOverlayObserver() {
  if (_overlayROInit) return;
  const canvas = document.getElementById("pdfCanvas");
  if (!canvas || typeof ResizeObserver === "undefined") return;
  const ro = new ResizeObserver(() => syncOverlayToCanvas());
  ro.observe(canvas);
  _overlayROInit = true;
}

/* ---------- state helpers ---------- */
function getPageList(pageNum) {
  const anns = state.annotations || {};
  const page = anns[pageNum];
  return Array.isArray(page) ? page : [];
}
function setPageList(pageNum, newList) {
  const prevAnns = state.annotations || {};
  const pageCopy = Array.isArray(newList) ? newList.slice() : [];
  const nextAnns = { ...prevAnns, [pageNum]: pageCopy };
  try { state.annotations = nextAnns; }
  catch { if (typeof state.setAnnotations === "function") state.setAnnotations(nextAnns);
          else console.warn("[render] annotations container is read-only; updates may not persist."); }
  return getPageList(pageNum);
}
function replaceAnn(pageNum, oldAnn, patch) {
  const pageList = getPageList(pageNum);
  const i = pageList.indexOf(oldAnn);
  if (i < 0) return oldAnn;
  const updated = { ...oldAnn, ...patch };
  const nextList = pageList.slice();
  nextList.splice(i, 1, updated);
  setPageList(pageNum, nextList);
  return updated;
}
function removeAnn(pageNum, ann) {
  const pageList = getPageList(pageNum);
  const i = pageList.indexOf(ann);
  if (i < 0) return;
  const nextList = pageList.slice();
  nextList.splice(i, 1);
  setPageList(pageNum, nextList);
}

/* ---------- simple builders ---------- */
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

/* ---------- main render ---------- */
export function renderAnnotationsForPage(pageNum /* , viewport? */) {
  const canvas = document.getElementById("pdfCanvas");
  const layer  = document.getElementById("annoLayer");
  if (!canvas || !layer) return;

  ensureOverlayObserver();
  syncOverlayToCanvas();
  if (typeof clearOverlay === "function") clearOverlay(); else layer.innerHTML = "";

  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;

  const list = getPageList(pageNum);

  for (let ann of list) {
    if (ann.type === "highlight") {
      const [x, y, w, h] = denormalizeRect(...ann.rect, cw, ch);
      layer.appendChild(makeHighlightPx({ x, y, w, h }));

    } else if (ann.type === "note") {
      const [x, y] = denormalizePoint(ann.pos[0], ann.pos[1], cw, ch);
      const { root, header, body, close } = makeStickyPx({ x, y, text: ann.text });
      root._annRef = ann;

      header.style.touchAction = "none";

      // NOTE drag (with guides)
      const startNoteDrag = makeDrag({
        getSizeAtStart: ()=>({ cw, ch, w: root.offsetWidth, h: root.offsetHeight }),
        getStartLeftTop: ()=>{
          const r=root.getBoundingClientRect(), lr=layer.getBoundingClientRect();
          return { ox: r.left - lr.left, oy: r.top - lr.top };
        },
        applyVisual: (nx,ny,ox,oy)=>{ root.style.willChange="transform"; root.style.transform=`translate(${nx-ox}px, ${ny-oy}px)`; },
        clearVisual: ()=>{ root.style.transform=""; root.style.willChange=""; },
        commit: (fx,fy,CW,CH,started)=>{
          root.style.left=`${fx}px`; root.style.top=`${fy}px`;
          const nx=fx/CW, ny=fy/CH, prev=root._annRef.pos||[];
          const changed=(nx!==prev[0])||(ny!==prev[1]);
          root._annRef = replaceAnn(pageNum, root._annRef, { pos:[nx,ny] });
          return changed && started;
        },
        pageNum, layer, excludeAnn: ann
      });
      header.addEventListener("pointerdown", (e)=>startNoteDrag(e, header), { passive: false });

      // Note text save + delete
      body.addEventListener("blur", () => {
        const prev = root._annRef.text || "";
        const next = body.textContent || "";
        if (prev !== next) {
          historyBegin();
          root._annRef = replaceAnn(pageNum, root._annRef, { text: next });
          scheduleSave();
          historyCommit();
        }
      });
      close.addEventListener("click", () => {
        historyBegin();
        removeAnn(pageNum, root._annRef);
        root.remove();
        scheduleSave();
        historyCommit();
      });

      layer.appendChild(root);

    } else if (ann.type === "text") {
      const [nx, ny, nw, nh] = ann.rect;
      let x = nx * cw, y = ny * ch, w = nw * cw, h = nh * ch;

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

      const updateEmpty = () => {
        const t = (body.textContent || "").trim();
        body.classList.toggle("is-empty", t.length === 0);
      };
      body.addEventListener("input", updateEmpty);
      body.addEventListener("blur", () => {
        const prev = cur.text || "";
        const next = body.textContent || "";
        if (prev !== next) {
          historyBegin();
          cur = replaceAnn(pageNum, cur, { text: next });
          scheduleSave();
          historyCommit();
        }
        updateEmpty();
      });
      updateEmpty();

      // TEXT drag (with guides)
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
        pageNum, layer, excludeAnn: cur
      });
      head.addEventListener("pointerdown", (e)=>startTextDrag(e, head), { passive: false });

      // TEXT resize with guides (bottom-right handle)
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

        const ctrl = new AbortController();
        const sig = ctrl.signal;

        const guideUI = ensureGuideElems(layer);
        const guides = renderConfig.snapToGuides ? collectGuides(pageNum, cur, cw, ch) : { xLines: [], yLines: [] };

        const paint = rafThrottle(() => {
          let w = clamp(curW, renderConfig.minTextW, maxW);
          let h = clamp(curH, renderConfig.minTextH, maxH);

          // Shift: constrain to dominant axis
          if (shift) {
            if (Math.abs(w - startW) >= Math.abs(h - startH)) h = startH;
            else w = startW;
          }

          // Edge snap & magnetic guides on right/bottom
          w = snapEdge(w, maxW, renderConfig.snapEdgePx);
          h = snapEdge(h, maxH, renderConfig.snapEdgePx);
          let gx = null, gy = null;
          if (renderConfig.snapToGuides && (guides.xLines.length || guides.yLines.length)) {
            const s = magneticSnapResize({
              leftPx, topPx, w, h,
              guides, threshold: renderConfig.snapEdgePx,
              useGrid: false, grid: renderConfig.gridPx
            });
            w = s.newW; h = s.newH; gx = s.gx; gy = s.gy;
          }

          // optional grid
          if (alt) {
            w = snapGrid(w, renderConfig.gridPx);
            h = snapGrid(h, renderConfig.gridPx);
            w = clamp(w, renderConfig.minTextW, maxW);
            h = clamp(h, renderConfig.minTextH, maxH);
          }

          guideUI.show(gx, gy);
          box.style.width  = `${w}px`;
          box.style.height = `${h}px`;
        });

        const onMove = (ev) => {
          if (ev.pointerId !== pid) return;
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (!started && (dx || dy)) { historyBegin(); started = true; document.body.style.userSelect = "none"; }
          curW = startW + dx;
          curH = startH + dy;
          paint();
        };
        const finish = (cancelled=false) => {
          try { grip.releasePointerCapture?.(pid); } catch {}
          document.body.style.userSelect = "";
          guideUI.clear();
          if (cancelled) { ctrl.abort(); return; }

          // Compute final size with same rules as paint
          let w = clamp(curW, renderConfig.minTextW, maxW);
          let h = clamp(curH, renderConfig.minTextH, maxH);
          if (shift) {
            if (Math.abs(w - startW) >= Math.abs(h - startH)) h = startH;
            else w = startW;
          }
          w = snapEdge(w, maxW, renderConfig.snapEdgePx);
          h = snapEdge(h, maxH, renderConfig.snapEdgePx);
          if (renderConfig.snapToGuides && (guides.xLines.length || guides.yLines.length)) {
            const s = magneticSnapResize({
              leftPx, topPx, w, h,
              guides, threshold: renderConfig.snapEdgePx,
              useGrid: false, grid: renderConfig.gridPx
            });
            w = s.newW; h = s.newH;
          }
          if (alt) {
            w = snapGrid(w, renderConfig.gridPx);
            h = snapGrid(h, renderConfig.gridPx);
            w = clamp(w, renderConfig.minTextW, maxW);
            h = clamp(h, renderConfig.minTextH, maxH);
          }

          const wN = w / cw;
          const hN = h / ch;
          const xN = leftPx / cw;
          const yN = topPx  / ch;
          const sizeChanged = (wN !== cur.rect[2]) || (hN !== cur.rect[3]);
          if (sizeChanged) {
            const autoFont = Math.max(10, Math.round(h * 0.45));
            const nextFont = cur.fontSize ?? autoFont;
            cur = replaceAnn(pageNum, cur, { rect:[xN, yN, wN, hN], fontSize: nextFont });
            body.style.fontSize = `${cur.fontSize}px`;
            scheduleSave(); historyCommit();
          }
          ctrl.abort();
        };
        const onUp = (ev) => { if (ev.pointerId !== pid) return; finish(false); };
        const onCancel = (ev) => { if (ev.pointerId !== pid) return; finish(true); };
        const onKey = (ev) => {
          if (ev.key === "Shift") { shift = ev.type === "keydown"; paint(); }
          else if (ev.key === "Alt") { alt = ev.type === "keydown"; paint(); }
          else if (ev.key === "Escape" && ev.type === "keydown") { finish(true); }
        };

        window.addEventListener("pointermove", onMove,   { signal: sig });
        window.addEventListener("pointerup",   onUp,     { signal: sig });
        window.addEventListener("pointercancel", onCancel, { signal: sig });
        window.addEventListener("keydown", onKey, { signal: sig });
        window.addEventListener("keyup",   onKey, { signal: sig });
      }, { passive: false });

      // Delete
      close.addEventListener("click", () => {
        historyBegin();
        removeAnn(pageNum, cur);
        box.remove();
        scheduleSave();
        historyCommit();
      });

    } else if (ann.type === "image") {
      const [x, y, w, h] = denormalizeRect(...ann.rect, cw, ch);
      layer.appendChild(makeImagePx({ x, y, w, h, src: ann.src }));
    }
  }
}

/* Flush debounced saves on tab close/navigation */
window.addEventListener("beforeunload", () => scheduleSave(true));
