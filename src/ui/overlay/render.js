// Orchestrator: loops annotations and delegates to per-type views
import { clearOverlay } from "./layout";
import { renderConfig, updateRenderConfig } from "./config";
import { getPageList } from "./stateOps";
import { ensureOverlayObserver, syncOverlayToCanvas } from "./sizer";

import { renderHighlight } from "./views/highlightView";
import { renderImage }     from "./views/imageView";
import { renderNote }      from "./views/noteView";
import { renderText }      from "./views/textView";

export { renderConfig, updateRenderConfig };

export function renderAnnotationsForPage(pageNum) {
  const canvas = document.getElementById("pdfCanvas");
  const layer  = document.getElementById("annoLayer");
  if (!canvas || !layer) return;

  ensureOverlayObserver();
  syncOverlayToCanvas();
  if (typeof clearOverlay === "function") clearOverlay(); else layer.innerHTML = "";

  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;

  const list = getPageList(pageNum);
  for (const ann of list) {
    switch (ann.type) {
      case "highlight": renderHighlight(layer, ann, cw, ch); break;
      case "image":     renderImage(layer, ann, pageNum, cw, ch);     break;
      case "note":      renderNote(layer, ann, pageNum, cw, ch); break;
      case "text":      renderText(layer, ann, pageNum, cw, ch); break;
      default: /* ignore */ break;
    }
  }
}
