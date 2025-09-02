// Generic pointer-drag with snapping/guides + history + debounced save
import { historyBegin, historyCommit } from "@app/history";
import { renderConfig, clamp, rafThrottle, snapEdge, snapGrid } from "./config";
import { scheduleSave } from "@app/persistence";
import { collectGuides, ensureGuideElems, magneticSnapMove } from "./guides";

export function makeDrag({ getStartLeftTop, getSizeAtStart, applyVisual, clearVisual, commit, pageNum, layer, excludeAnn }) {
  let sx=0, sy=0, ox=0, oy=0, dx=0, dy=0, started=false, size={cw:0,ch:0,w:0,h:0}, pid=null, ctrl=null, captureEl=null;
  let shift=false, alt=false;
  const guideUI = ensureGuideElems(layer);
  let guides = { xLines: [], yLines: [] };

  const paint = rafThrottle(() => {
    const edgeThr = renderConfig.snapEdgePx, grid = renderConfig.gridPx;
    let rx = ox + dx, ry = oy + dy;
    if (shift) { if (Math.abs(dx) >= Math.abs(dy)) ry = oy; else rx = ox; }
    rx = clamp(rx, 0, size.cw - size.w);
    ry = clamp(ry, 0, size.ch - size.h);
    rx = snapEdge(rx, size.cw - size.w, edgeThr);
    ry = snapEdge(ry, size.ch - size.h, edgeThr);
    let gx = null, gy = null;
    if (renderConfig.snapToGuides && (guides.xLines.length || guides.yLines.length)) {
      const s = magneticSnapMove({ rx, ry, size, guides, threshold: edgeThr, useGrid: false, grid });
      rx = s.nx; ry = s.ny; gx = s.gx; gy = s.gy;
    }
    if (alt) { rx = snapGrid(rx, grid); ry = snapGrid(ry, grid); }
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

    const edgeThr = renderConfig.snapEdgePx, grid = renderConfig.gridPx;
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
