import { state, markAnnotationsChanged } from "@app/state";
import { ensureMutablePageAnnotations } from "@app/utils/state";
import { saveState } from "@app/persistence";
import { renderAnnotationsForPage } from "@ui/overlay";
import { historyBegin, historyCommit } from "@app/history";
import { normalizeRect } from "@ui/overlay/highlight";
import {
  describeRangeAnchors,
  setTextLayerInteractive,
  getCharOffsetFromPoint,
  createRangeForOffsets,
} from "@pdf/textLayer";

let selectionController = null;
let processTimer = null;
let active = false;
let copySelectionEnabled = false;
let copySelectionController = null;
const copySelectionState = {
  pointerId: null,
  anchorOffset: null,
  focusOffset: null,
};

let highlightClickGuardController = null;

const SELECT_LOG_KEY = "__selectDebugLog";
const SELECT_LOG_MAX = 200;
let selectLogDirty = false;
const SELECT_LOG_PERSIST_KEY = "select-debug-log";
let selectUploadQueue = [];
let selectUploadScheduled = false;
const SELECT_UPLOAD_DELAY = 400;

function flushUploadQueue() {
  selectUploadScheduled = false;
  if (typeof window === "undefined") return;
  if (!selectUploadQueue.length) return;
  const payload = JSON.stringify(selectUploadQueue.splice(0, selectUploadQueue.length));
  const send = (body) => {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/__select-log', blob)) {
        return;
      }
    }
    fetch('/__select-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  };
  send(payload);
}

function enqueueUpload(entry) {
  if (typeof window === "undefined") return;
  selectUploadQueue.push(entry);
  if (!selectUploadScheduled) {
    selectUploadScheduled = true;
    setTimeout(flushUploadQueue, SELECT_UPLOAD_DELAY);
  }
}

function getLogStore() {
  if (typeof window === "undefined") return null;
  const store = (window[SELECT_LOG_KEY] ||= []);
  if (Array.isArray(store)) return store;
  window[SELECT_LOG_KEY] = [];
  return window[SELECT_LOG_KEY];
}

function logSelect(event, detail = {}) {
  if (typeof window === "undefined") return;
  const store = getLogStore();
  if (!store) return;
  const entry = {
    ts: Date.now(),
    event,
    ...detail,
  };
  store.push(entry);
  while (store.length > SELECT_LOG_MAX) {
    store.shift();
  }
  selectLogDirty = true;
  enqueueUpload(entry);
  /* eslint-disable no-console */
  if (import.meta?.env?.DEV) {
    console.debug(`[select] ${event}`, detail);
  }
  /* eslint-enable no-console */
}

if (typeof window !== "undefined") {
  window.__logSelectEvent = (event, detail) => logSelect(event, detail);
}

if (typeof window !== "undefined") {
  window.__dumpSelectDebugLog = () => JSON.parse(JSON.stringify(getLogStore() || []));
  window.__clearSelectDebugLog = () => {
    const store = getLogStore();
    if (store) store.length = 0;
    selectLogDirty = true;
    try { localStorage.removeItem(SELECT_LOG_PERSIST_KEY); } catch {}
  };
  window.__downloadSelectDebugLog = () => {
    try {
      const store = getLogStore() || [];
      const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `select-debug-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download select debug log", err);
    }
  };
}

function persistSelectLog() {
  if (typeof window === "undefined" || !selectLogDirty) return;
  const store = getLogStore();
  if (!store) return;
  try {
    localStorage.setItem(SELECT_LOG_PERSIST_KEY, JSON.stringify(store));
    selectLogDirty = false;
  } catch (err) {
    console.warn("[select] failed to persist log", err);
  }
}

function loadPersistedSelectLog() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SELECT_LOG_PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const store = getLogStore();
    if (!Array.isArray(parsed) || !store) return;
    store.splice(0, store.length, ...parsed.slice(-SELECT_LOG_MAX));
  } catch (err) {
    console.warn("[select] failed to load persisted log", err);
  }
}

function updateTextLayerInteractivity() {
  setTextLayerInteractive(active || copySelectionEnabled);
}

function installHighlightClickGuard() {
  if (!active) return;
  if (highlightClickGuardController) return;
  const layer = document.getElementById("textLayer");
  if (!layer) return;

  const controller = new AbortController();
  const { signal } = controller;

  const cancelSelection = (event, detail) => {
    if (!active) return;
    if (event.button !== 0) return;
    if (detail <= 1) return;
    event.preventDefault();
    event.stopPropagation();
    try { window.getSelection?.()?.removeAllRanges?.(); } catch {}
    logSelect("highlight-double-click-blocked", { detail, type: event.type });
  };

  const onMouseDown = (event) => {
    const detail = typeof event.detail === "number" ? event.detail : 1;
    cancelSelection(event, detail);
  };

  const onDoubleClick = (event) => {
    cancelSelection(event, 2);
  };

  layer.addEventListener("mousedown", onMouseDown, { signal, capture: true, passive: false });
  layer.addEventListener("dblclick", onDoubleClick, { signal, capture: true, passive: false });
  highlightClickGuardController = controller;
}

function removeHighlightClickGuard() {
  if (!highlightClickGuardController) return;
  highlightClickGuardController.abort();
  highlightClickGuardController = null;
}

function isOverlayAnnotationTarget(el) {
  if (!el) return false;
  return !!el.closest?.(
    ".sticky-note, .text-box, .image-box, .note-header, .text-header, .note-body, .text-body"
  );
}

function applySelectionOffsets(start, end) {
  if (start == null || end == null) return false;
  const range = createRangeForOffsets(start, end);
  if (!range) {
    const root = typeof document !== "undefined" ? document.getElementById("textLayer")?.firstElementChild : null;
    const length = root ? Number(root.dataset?.charLength || "0") : null;
    logSelect("range-null", { start, end, charLength: length });
    return false;
  }
  try {
    const selection = window.getSelection?.();
    if (!selection) return false;
    selection.removeAllRanges?.();
    selection.addRange?.(range);
    logSelect("range-applied", { start, end });
    return true;
  } catch (err) {
    logSelect("range-apply-error", { error: String(err) });
    return false;
  }
}

function clearCopySelectionState() {
  const layer = document.getElementById("annoLayer");
  if (layer && copySelectionState.pointerId != null) {
    try { layer.releasePointerCapture?.(copySelectionState.pointerId); } catch {}
  }
  copySelectionState.pointerId = null;
  copySelectionState.anchorOffset = null;
  copySelectionState.focusOffset = null;
}

function ensureCopySelectionHandlers() {
  if (!copySelectionEnabled) return false;
  if (copySelectionController) return true;
  const layer = document.getElementById("annoLayer");
  if (!layer) {
    logSelect("install-waiting", { reason: "no-anno-layer" });
    return false;
  }

  const controller = new AbortController();
  const { signal } = controller;

  const onPointerDown = (event) => {
    logSelect("pointerdown", {
      enabled: copySelectionEnabled,
      tool: state.tool,
      button: event.button,
      target: event.target?.className,
    });
    if (!copySelectionEnabled) return;
    if (event.button !== 0) return;
    if (isOverlayAnnotationTarget(event.target)) {
      logSelect("pointerdown-ignored", { reason: "annotation-chrome" });
      return;
    }

    const charOffset = getCharOffsetFromPoint(event.clientX, event.clientY);
    if (typeof charOffset !== "number") {
      logSelect("anchor-null", {
        x: event.clientX,
        y: event.clientY,
      });
      return;
    }
    logSelect("anchor-offset", { offset: charOffset });

    const applied = applySelectionOffsets(charOffset, charOffset);
    if (!applied) {
      clearCopySelectionState();
      return;
    }

    copySelectionState.pointerId = event.pointerId;
    copySelectionState.anchorOffset = charOffset;
    copySelectionState.focusOffset = charOffset;
    try { layer.setPointerCapture?.(event.pointerId); } catch {}
    event.preventDefault();
  };

  const onPointerMove = (event) => {
    if (!copySelectionEnabled) return;
    if (copySelectionState.pointerId !== event.pointerId) return;
    const charOffset = getCharOffsetFromPoint(event.clientX, event.clientY);
    if (typeof charOffset !== "number") {
      logSelect("focus-null", {
        x: event.clientX,
        y: event.clientY,
      });
      return;
    }
    copySelectionState.focusOffset = charOffset;
    const anchor = copySelectionState.anchorOffset;
    if (typeof anchor !== "number") return;
    const start = Math.min(anchor, charOffset);
    const end = Math.max(anchor, charOffset);
    logSelect("focus-offset", { offset: charOffset, start, end });
    applySelectionOffsets(start, end);
    event.preventDefault();
  };

  const finish = () => {
    clearCopySelectionState();
    logSelect("pointer-finish", {});
  };

  const onPointerUp = (event) => {
    if (copySelectionState.pointerId !== event.pointerId) return;
    finish();
  };

  const onPointerCancel = (event) => {
    if (copySelectionState.pointerId !== event.pointerId) return;
    finish();
  };

  layer.addEventListener("pointerdown", onPointerDown, { signal, passive: false });
  layer.addEventListener("pointermove", onPointerMove, { signal, passive: false });
  layer.addEventListener("pointerup", onPointerUp, { signal, passive: true });
  layer.addEventListener("pointercancel", onPointerCancel, { signal, passive: true });

  copySelectionController = controller;
  logSelect("install-success", {});
  return true;
}

function teardownCopySelectionHandlers() {
  if (!copySelectionController) return;
  copySelectionController.abort();
  copySelectionController = null;
  clearCopySelectionState();
  logSelect("install-teardown", {});
}

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
  loadPersistedSelectLog();
  selectionController = new AbortController();
  const { signal } = selectionController;
  document.addEventListener("pointerup", handlePointerUp, { signal, passive: true });
  document.addEventListener("selectionchange", handleSelectionChange, { signal });
  document.addEventListener("keyup", handleKeyUp, { signal });
  window.addEventListener("beforeunload", () => {
    persistSelectLog();
    flushUploadQueue();
  }, { signal });
}

export function setTextHighlightMode(enabled) {
  active = !!enabled;
  updateTextLayerInteractivity();
  if (active) {
    installHighlightClickGuard();
  } else {
    removeHighlightClickGuard();
  }
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
  updateTextLayerInteractivity();
  removeHighlightClickGuard();
  persistSelectLog();
  flushUploadQueue();
}

export function setCopySelectionEnabled(enabled) {
  copySelectionEnabled = !!enabled;
  if (copySelectionEnabled) {
    const tryInstall = () => {
      if (!copySelectionEnabled || copySelectionController) return;
      if (!ensureCopySelectionHandlers()) {
        requestAnimationFrame(tryInstall);
      }
    };
    logSelect("enable-copy-select", {});
    tryInstall();
  } else {
    logSelect("disable-copy-select", {});
    teardownCopySelectionHandlers();
    if (typeof window !== "undefined") {
      try { window.getSelection?.()?.removeAllRanges?.(); } catch {}
    }
  }
  updateTextLayerInteractivity();

  if (copySelectionEnabled && !copySelectionController) {
    // The layer might not be ready yet; retry once DOM settles
    requestAnimationFrame(() => {
      if (copySelectionEnabled) ensureCopySelectionHandlers();
    });
  }
}
