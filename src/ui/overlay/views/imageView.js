import { makeDrag } from "../drag";
import { replaceAnn } from "../stateOps";

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

  layer.appendChild(box);
}
