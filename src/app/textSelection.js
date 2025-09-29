import { state, markAnnotationsChanged } from "@app/state";
import { ensureMutablePageAnnotations } from "@app/utils/state";
import { saveState } from "@app/persistence";
import { renderAnnotationsForPage } from "@ui/overlay";
import { historyBegin, historyCommit } from "@app/history";
import { normalizeRect } from "@ui/overlay/highlight";
import { describeRangeAnchors, setTextLayerInteractive } from "@pdf/textLayer";

let selectionController = null;
let processTimer = null;
let active = false;

function scheduleProcessSelection(delay = 40) {
  if (!active) return;
  if (processTimer) clearTimeout(processTimer);
  processTimer = setTimeout(() => {
    processTimer = null;
    processSelection();
  }, delay);
}

function processSelection() {
  if (!active) return;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;
  if (selection.rangeCount === 0) return;

  const textLayer = document.getElementById("textLayer");
  const canvas = document.getElementById("pdfCanvas");
  if (!textLayer || !canvas) return;

  const range = selection.getRangeAt(0).cloneRange();
  if (!textLayer.contains(range.startContainer) || !textLayer.contains(range.endContainer)) {
    return;
  }

  const rects = Array.from(range.getClientRects());
  if (!rects.length) return;

  const layerRect = textLayer.getBoundingClientRect();
  const cw = canvas.clientWidth || canvas.width;
  const ch = canvas.clientHeight || canvas.height;
  const normalizedRects = [];

  for (const rect of rects) {
    const w = rect.width;
    const h = rect.height;
    if (w < 2 || h < 2) continue;
    const x = rect.left - layerRect.left;
    const y = rect.top - layerRect.top;
    normalizedRects.push(normalizeRect(x, y, w, h, cw, ch));
  }

  if (!normalizedRects.length) return;

  const anchorInfo = describeRangeAnchors(range);
  const selectionText = selection.toString();

  const bucket = ensureMutablePageAnnotations(state.pageNum);
  const label = `Highlight text (page ${state.pageNum})`;
  historyBegin(label);

  const highlight = {
    type: "highlight",
    rect: normalizedRects[0],
    rects: normalizedRects,
    source: "text",
    anchors: anchorInfo
      ? {
          page: anchorInfo.page,
          start: { ...anchorInfo.start },
          end: { ...anchorInfo.end },
        }
      : null,
    text: selectionText,
    createdAt: Date.now(),
  };

  bucket.push(highlight);

  markAnnotationsChanged();
  saveState();
  historyCommit(label);
  renderAnnotationsForPage(state.pageNum);
  try { selection.removeAllRanges(); } catch {}
}

function handlePointerUp() {
  scheduleProcessSelection(40);
}

function handleKeyUp(event) {
  if (!active) return;
  if (event.key && event.key.startsWith("Arrow")) {
    scheduleProcessSelection(60);
  }
}

function handleSelectionChange() {
  scheduleProcessSelection(80);
}

export function initTextSelection() {
  if (selectionController) return;
  selectionController = new AbortController();
  const { signal } = selectionController;
  document.addEventListener("pointerup", handlePointerUp, { signal, passive: true });
  document.addEventListener("selectionchange", handleSelectionChange, { signal });
  document.addEventListener("keyup", handleKeyUp, { signal });
}

export function setTextHighlightMode(enabled) {
  active = !!enabled;
  setTextLayerInteractive(active);
  if (!active) {
    if (processTimer) {
      clearTimeout(processTimer);
      processTimer = null;
    }
    try {
      const selection = window.getSelection();
      selection?.removeAllRanges();
    } catch {}
  }
}

export function teardownTextSelection() {
  if (!selectionController) return;
  selectionController.abort();
  selectionController = null;
  processTimer && clearTimeout(processTimer);
  processTimer = null;
  active = false;
}

