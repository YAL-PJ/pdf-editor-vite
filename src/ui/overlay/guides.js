// src/ui/overlay/guides.js
import { snapGrid } from "./config";
import { getPageList } from "./stateOps";

export function collectGuides(pageNum, excludeAnn, cw, ch) {
  const list = getPageList(pageNum);
  const xLines = [], yLines = [];
  for (const ann of list) {
    if (ann === excludeAnn) continue;
    if (ann.type === "text" || ann.type === "image" || ann.type === "highlight") {
      const [nx, ny, nw, nh] = ann.rect;
      const x = nx * cw, y = ny * ch, w = nw * cw, h = nh * ch;
      xLines.push(x, x + w, x + w / 2);
      yLines.push(y, y + h, y + h / 2);
    } else if (ann.type === "note") {
      const [px, py] = ann.pos || [0, 0];
      xLines.push(px * cw); yLines.push(py * ch);
    }
  }
  const uniq = (arr) => {
    const seen = new Set(), out = [];
    for (const v of arr) {
      const k = Math.round(v * 2) / 2;
      if (!seen.has(k)) { seen.add(k); out.push(v); }
    }
    return out;
  };
  return { xLines: uniq(xLines), yLines: uniq(yLines) };
}

export function ensureGuideElems(layer) {
  let gx = layer.querySelector(".guide-x");
  let gy = layer.querySelector(".guide-y");
  if (!gx) {
    gx = document.createElement("div");
    gx.className = "guide-x";
    Object.assign(gx.style, {
      position: "absolute", top: "0", width: "1px", height: "100%",
      background: "rgba(46,170,220,0.8)", pointerEvents: "none",
      transform: "translateX(-0.5px)", display: "none", zIndex: 9999
    });
    layer.appendChild(gx);
  }
  if (!gy) {
    gy = document.createElement("div");
    gy.className = "guide-y";
    Object.assign(gy.style, {
      position: "absolute", left: "0", width: "100%", height: "1px",
      background: "rgba(46,170,220,0.8)", pointerEvents: "none",
      transform: "translateY(-0.5px)", display: "none", zIndex: 9999
    });
    layer.appendChild(gy);
  }
  return {
    show(x, y) {
      gx.style.display = typeof x === "number" ? "block" : "none";
      gy.style.display = typeof y === "number" ? "block" : "none";
      if (typeof x === "number") gx.style.left = `${x}px`;
      if (typeof y === "number") gy.style.top  = `${y}px`;
    },
    clear() { gx.style.display = "none"; gy.style.display = "none"; }
  };
}

export function magneticSnapMove({ rx, ry, size, guides, threshold, useGrid, grid }) {
  let snapX = null, snapY = null, bestDx = Infinity, bestDy = Infinity;
  const left = rx, right = rx + size.w, cx = rx + size.w / 2;
  for (const line of guides.xLines) {
    const d = Math.min(Math.abs(line - left), Math.abs(line - right), Math.abs(line - cx));
    if (d <= threshold && d < bestDx) { bestDx = d; // pick nearest edge/center
      if (d === Math.abs(line - left)) snapX = line - (left - rx);
      else if (d === Math.abs(line - right)) snapX = line - (right - rx);
      else snapX = line - (cx - rx);
    }
  }
  const top = ry, bottom = ry + size.h, cy = ry + size.h / 2;
  for (const line of guides.yLines) {
    const d = Math.min(Math.abs(line - top), Math.abs(line - bottom), Math.abs(line - cy));
    if (d <= threshold && d < bestDy) { bestDy = d;
      if (d === Math.abs(line - top)) snapY = line - (top - ry);
      else if (d === Math.abs(line - bottom)) snapY = line - (bottom - ry);
      else snapY = line - (cy - ry);
    }
  }
  let nx = snapX ?? rx, ny = snapY ?? ry;
  if (useGrid) { nx = snapGrid(nx, grid); ny = snapGrid(ny, grid); }
  return { nx, ny, gx: snapX != null ? (snapX + 0) : null, gy: snapY != null ? (snapY + 0) : null };
}

export function magneticSnapResize({ leftPx, topPx, w, h, guides, threshold, useGrid, grid }) {
  let snapRight = null, snapBottom = null, bestDx = Infinity, bestDy = Infinity;
  const right = leftPx + w, bottom = topPx + h;
  for (const line of guides.xLines) {
    const d = Math.abs(line - right); if (d <= threshold && d < bestDx) { bestDx = d; snapRight = line; }
  }
  for (const line of guides.yLines) {
    const d = Math.abs(line - bottom); if (d <= threshold && d < bestDy) { bestDy = d; snapBottom = line; }
  }
  let newW = snapRight != null ? (snapRight - leftPx) : w;
  let newH = snapBottom != null ? (snapBottom - topPx) : h;
  if (useGrid) { newW = snapGrid(newW, grid); newH = snapGrid(newH, grid); }
  return { newW, newH, gx: snapRight, gy: snapBottom };
}
    