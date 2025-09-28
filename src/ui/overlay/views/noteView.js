import { makeStickyPx, denormalizePoint } from "../notes";
import { historyBegin, historyCommit } from "@app/history";
import { replaceAnn, removeAnn } from "../stateOps";
import { makeDrag } from "../drag";
import { scheduleSave } from "@app/persistence";

const quoteHistoryText = (value = "") => {
  if (value == null) return "";
  const raw = String(value);
  if (!raw.trim()) return "";
  try {
    return JSON.stringify(raw);
  } catch {
    return JSON.stringify(raw.slice(0));
  }
};

export function renderNote(layer, ann, pageNum, cw, ch) {
  const [x, y] = denormalizePoint(ann.pos[0], ann.pos[1], cw, ch);
  const { root, header, body, close } = makeStickyPx({ x, y, text: ann.text });
  root._annRef = ann;
  header.style.touchAction = "none";

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
    pageNum,
    layer,
    excludeAnn: ann,
    historyLabel: () => {
      const snippet = quoteHistoryText(root._annRef?.text || "");
      return snippet ? `Move note ${snippet}` : "Move note";
    },
  });
  header.addEventListener("pointerdown", (e)=>startNoteDrag(e, header), { passive: false });

  body.addEventListener("blur", () => {
    const prev = root._annRef.text || "";
    const next = body.textContent || "";
    if (prev !== next) {
      const snippet = quoteHistoryText(next);
      const label = snippet ? `Update note ${snippet}` : "Clear note";
      historyBegin(label);
      root._annRef = replaceAnn(pageNum, root._annRef, { text: next });
      scheduleSave();
      historyCommit(label);
    }
  });
  close.addEventListener("click", () => {
    const snippet = quoteHistoryText(root._annRef?.text || "");
    const label = snippet ? `Delete note ${snippet}` : "Delete note";
    historyBegin(label);
    removeAnn(pageNum, root._annRef);
    root.remove();
    scheduleSave();
    historyCommit(label);
  });

  layer.appendChild(root);
}
