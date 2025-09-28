/**
 * controller.js
 * Central app logic: manages state, rendering, toolbar updates, and persistence.
 */
import { state } from "@app/state";
import { ui, setToolbarEnabled, setActiveToolButton } from "@ui/toolbar";
import { loadPDF } from "@pdf/pdfLoader";
import {
  renderAnnotationsForPage,
  setOverlayCursor,
  syncOverlayToCanvas,
  clearOverlay,
  setPannable,
} from "@ui/overlay";
import { updateLayoutOffsets } from "@app/layoutOffsets";
import { saveState, hasDataToLose, clearSavedState } from "./persistence";
import { undo, redo, historyInit, jumpToHistory } from "@app/history";
import { downloadAnnotatedPdf } from "@pdf/exportAnnotated";

import "../styles/switch-dialog.css";

/* ---------- Render serialization (prevents PDF.js double-render) ---------- */
let _renderTask = null;      // current PDF.js RenderTask, if any
let _rerenderQueued = false; // flag if a rerender was requested while busy

/* ---------- Small helpers ---------- */
const getFileInputEl = () => document.getElementById("fileInput");
const getViewerEl    = () => document.getElementById("viewer");
const getCanvasEl    = () => document.getElementById("pdfCanvas");

const makeDocId = (file) =>
  file ? `${file.name}|${file.size}|${file.lastModified || 0}` : null;

const makeSaveName = (originalName, marker = " (annotated)") => {
  if (!originalName) return "annotated.pdf";
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  const ext  = dot > 0 ? originalName.slice(dot) : ".pdf";
  const escMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cleanBase = base.replace(new RegExp(`${escMarker}$`), "");
  return `${cleanBase}${marker}${ext}`;
};

const escapeHtml = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const MIN_SCALE = 0.3;
const MAX_SCALE = 3.0;
const DEFAULT_ZOOM_STEP = 0.1;

const parsePageInput = (raw) => {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const num = Number.parseInt(trimmed, 10);
  return Number.isFinite(num) ? num : null;
};

const parseZoomPercent = (raw) => {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/%+$/, "").replace(/,/g, ".");
  if (!normalized) return null;
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
};

async function setScale(nextScale) {
  const clamped = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  if (Math.abs(clamped - state.scale) < 0.0001) {
    return state.scale;
  }
  state.scale = clamped;
  await rerender();
  return state.scale;
}

async function applyZoomDelta(delta) {
  if (!Number.isFinite(delta) || delta === 0) {
    return state.scale;
  }
  const next = state.scale + delta;
  return setScale(next);
}

/* ---------- Minimal, accessible switch dialog ---------- */
function showSwitchDialog(nextName) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.innerHTML = `
      <div class="switchdlg-backdrop" role="dialog" aria-modal="true" aria-labelledby="switchdlg-title">
        <div class="switchdlg-card" role="document">
          <h2 class="switchdlg-title" id="switchdlg-title">Switch PDF?</h2>
          <p class="switchdlg-body">
            You have a document open with annotations. Opening
            <b>${escapeHtml(nextName)}</b> will clear them in this window.
          </p>
          <div class="switchdlg-actions">
            <button class="switchdlg-btn" data-act="save">Save & Replace</button>
            <button class="switchdlg-btn" data-act="discard">Replace (discard)</button>
            <button class="switchdlg-btn" data-act="newtab">Open in new window</button>
            <button class="switchdlg-btn switchdlg-btn-secondary" data-act="cancel">Cancel</button>
          </div>
        </div>
      </div>`.trim();

    const root = host.firstElementChild;
    function close(act) {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
      document.body.removeChild(root);
      resolve(act);
    }
    function onClick(e) {
      if (e.target.tagName === "BUTTON") close(e.target.getAttribute("data-act"));
    }
    function onKey(e) {
      if (e.key === "Escape") close("cancel");
    }
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    document.body.appendChild(root);

    const firstBtn = root.querySelector("button[data-act]");
    firstBtn?.focus();
  });
}

/* ---------- Public: reset the whole document session ---------- */
export async function resetDocumentState() {
  const canvas = getCanvasEl();
  const ctx = canvas?.getContext?.("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

  clearOverlay?.();

  state.pdfDoc = null;
  state.loadedPdfData = null;
  state.pageNum = 1;
  state.scale = 1.0;
  state.annotations = {};
  try { state.annotationsVersion = 0; } catch {}
  state.viewports = {};
  state.pendingImageSrc = null;
  state.currentDocId = null;

  setActiveToolButton(null);
  setOverlayCursor(null);
  setToolbarEnabled(false);

  try {
    const pageInput = ui.pageNumEl();
    if (pageInput) {
      pageInput.value = "1";
      pageInput.dataset.current = "1";
      pageInput.setAttribute("aria-valuenow", "1");
      pageInput.setAttribute("aria-valuemin", "1");
      pageInput.removeAttribute("aria-valuemax");
      pageInput.removeAttribute("max");
    }
    const zoomInput = ui.zoomLevelEl();
    if (zoomInput) {
      zoomInput.value = "100%";
      zoomInput.dataset.current = "100%";
    }
  } catch {}

  // Restore "placeholder" so CSS reserves aspect-only space again
  getViewerEl()?.classList.remove("is-dragover");
  getViewerEl()?.classList.add("placeholder");

  await clearSavedState();
  historyInit();
}

/* ---------- Render current page (CLS-safe + crisp + zoom-preserving) ---------- */
export async function rerender() {
  if (!state.pdfDoc) return;

  // If a render is already running, coalesce requests into a single follow-up.
  if (_renderTask) {
    _rerenderQueued = true;
    return;
  }

  setToolbarEnabled(false);
  try {
    const page   = await state.pdfDoc.getPage(state.pageNum);
    const canvas = getCanvasEl();
    const viewer = getViewerEl() || canvas?.parentElement;
    if (!canvas || !viewer) return;

    // Use a stable container for "available" width to avoid feedback loops
    const container = document.querySelector(".viewer-scroll") || viewer.parentElement || viewer;

    // 1) Compute scale: fit-to-width * current zoom (state.scale)
    const baseVp    = page.getViewport({ scale: 1 });
    const available = Math.max(1, container.clientWidth);
    const fitScale  = available / baseVp.width;
    const scale     = fitScale * state.scale;
    const vp        = page.getViewport({ scale });

    // 2) Set CSS box size *before* rendering (prevents CLS),
    //    then set backing store for crisp output.
    const dpr  = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const cssW = Math.round(vp.width);
    const cssH = Math.round(vp.height);

    canvas.style.width  = `${cssW}px`;  // affects layout
    canvas.style.height = `${cssH}px`;  // affects layout
    canvas.width  = cssW * dpr;         // raster only
    canvas.height = cssH * dpr;         // raster only

    const ctx = canvas.getContext("2d", { alpha: false });

    // 3) Single active render; PDF.js will throw if we overlap on the same canvas
    _renderTask = page.render({ canvasContext: ctx, viewport: vp, intent: "display" });
    try {
      await _renderTask.promise;
    } catch (e) {
      // If you later adopt cancel(), ignore RenderingCancelledException
      if (e?.name !== "RenderingCancelledException") throw e;
    } finally {
      _renderTask = null;
    }

    // Overlay + UI
    if (!state.viewports) state.viewports = {};
    state.viewports[state.pageNum] = vp;

    syncOverlayToCanvas();
    renderAnnotationsForPage(state.pageNum, vp);

    const pageInput = ui.pageNumEl();
    if (pageInput) {
      const currentPage = String(state.pageNum);
      pageInput.value = currentPage;
      pageInput.dataset.current = currentPage;
      pageInput.setAttribute("aria-valuenow", currentPage);
      pageInput.setAttribute("aria-valuemin", "1");
      if (state.pdfDoc?.numPages) {
        const total = String(state.pdfDoc.numPages);
        pageInput.setAttribute("aria-valuemax", total);
        pageInput.setAttribute("max", total);
      }
    }

    const zoomInput = ui.zoomLevelEl();
    if (zoomInput) {
      const zoomText = `${Math.round(state.scale * 100)}%`;
      zoomInput.value = zoomText;
      zoomInput.dataset.current = zoomText;
    }

    updateLayoutOffsets();
  } finally {
    setToolbarEnabled(true);
  }

  // If more rerenders came in while we were busy, do exactly one more
  if (_rerenderQueued) {
    _rerenderQueued = false;
    await new Promise((r) => requestAnimationFrame(r)); // let layout settle
    return rerender();
  }
}

/* ---------- Open PDF ---------- */
export async function openFile(file) {
  const nextId = makeDocId(file);
  const currId = state.currentDocId || null;

  if (currId && nextId && currId !== nextId && hasDataToLose()) {
    const choice = await showSwitchDialog(file.name);

    if (choice === "cancel") {
      try { const el = getFileInputEl(); if (el) el.value = ""; } catch {}
      return;
    }
    if (choice === "newtab") {
      window.open(window.location.href, "_blank", "noopener");
      try { const el = getFileInputEl(); if (el) el.value = ""; } catch {}
      return;
    }
    if (choice === "save") {
      try {
        if (state.loadedPdfData) {
          const orig = state.originalFileName || localStorage.getItem("last_pdf_name") || "document.pdf";
          const saveAs = makeSaveName(orig);
          await downloadAnnotatedPdf(state.loadedPdfData, saveAs);
        }
      } catch (e) {
        console.error("Download annotated failed:", e);
      }
    }

    await resetDocumentState();
  }

  // Fresh open
  const { doc, rawData } = await loadPDF(file);

  // Defer removing placeholder until after the first render (prevents jump)
  clearOverlay();
  getViewerEl()?.classList.remove("is-dragover");
  state.pdfDoc = doc;
  state.loadedPdfData = rawData;
  state.pageNum = 1;
  state.annotations = {};
  try { state.annotationsVersion = 0; } catch {}
  state.viewports = {};
  state.pendingImageSrc = null;
  state.currentDocId = nextId || null;
  state.originalFileName = file?.name || state.originalFileName;
  try { if (file?.name) localStorage.setItem("last_pdf_name", file.name); } catch {}

  getViewerEl()?.classList.remove("is-dragover");
  ui.pageCountEl().textContent = String(state.pdfDoc.numPages);

  await rerender();
  getViewerEl()?.classList.remove("placeholder"); // remove after first layout-stable render
  historyInit();
  saveState();
}

/* ---------- Restore PDF ---------- */
export async function restoreFile() {
  if (!state.loadedPdfData) {
    console.warn("No loaded PDF data to restore.");
    return;
  }
  const restoredFile = new File([state.loadedPdfData], "restored.pdf");
  const { doc } = await loadPDF(restoredFile);

  clearOverlay();
  state.pdfDoc = doc;
  state.currentDocId = makeDocId(restoredFile);
  ui.pageCountEl().textContent = String(state.pdfDoc.numPages);

  await rerender();
  getViewerEl()?.classList.remove("placeholder"); // remove after first layout-stable render
  historyInit();
}

/* ---------- Toolbar handlers ---------- */
export const handlers = {
  onPrev: async () => {
    if (!state.pdfDoc || state.pageNum <= 1) return;
    state.pageNum -= 1;
    await rerender();
  },
  onNext: async () => {
    if (!state.pdfDoc || state.pageNum >= state.pdfDoc.numPages) return;
    state.pageNum += 1;
    await rerender();
  },
  onZoomIn: async (step = DEFAULT_ZOOM_STEP) => {
    if (!state.pdfDoc) return;
    if (import.meta?.env?.DEV) console.count("zoomIn");  // debug counter
    await applyZoomDelta(Math.abs(step));
  },
  onZoomOut: async (step = DEFAULT_ZOOM_STEP) => {
    if (!state.pdfDoc) return;
    if (import.meta?.env?.DEV) console.count("zoomOut"); // debug counter
    await applyZoomDelta(-Math.abs(step));
  },
  onPageInput: async (rawValue) => {
    const current = state.pageNum || 1;
    const input = ui.pageNumEl();
    if (!state.pdfDoc) {
      if (input) {
        const currentText = String(current);
        input.value = currentText;
        input.dataset.current = currentText;
      }
      return current;
    }

    const parsed = parsePageInput(rawValue);
    if (parsed == null) {
      const fallback = String(state.pageNum);
      if (input) {
        input.value = fallback;
        input.dataset.current = fallback;
      }
      return state.pageNum;
    }

    const total = state.pdfDoc?.numPages || 1;
    const target = clamp(parsed, 1, total);
    if (target !== state.pageNum) {
      state.pageNum = target;
      await rerender();
    } else if (input) {
      const text = String(state.pageNum);
      input.value = text;
      input.dataset.current = text;
    }
    return state.pageNum;
  },
  onZoomInput: async (rawValue) => {
    const zoomInput = ui.zoomLevelEl();
    const currentText = `${Math.round(state.scale * 100)}%`;
    if (!state.pdfDoc) {
      if (zoomInput) {
        zoomInput.value = currentText;
        zoomInput.dataset.current = currentText;
      }
      return currentText;
    }

    const parsed = parseZoomPercent(rawValue);
    if (parsed == null) {
      if (zoomInput) {
        zoomInput.value = currentText;
        zoomInput.dataset.current = currentText;
      }
      return currentText;
    }

    const clampedPercent = clamp(parsed, MIN_SCALE * 100, MAX_SCALE * 100);
    const nextScale = clampedPercent / 100;
    const applied = await setScale(nextScale);

    const finalText = `${Math.round(applied * 100)}%`;
    if (zoomInput) {
      zoomInput.value = finalText;
      zoomInput.dataset.current = finalText;
    }
    return finalText;
  },
  onToolChange: (tool) => {
    state.tool = tool || null;
    setActiveToolButton(tool || null);
    setOverlayCursor(tool || null);
    // Enable drag-to-pan only when no tool is active (select mode)
    try { setPannable(!state.tool); } catch {}
  },
  onPickImage: () => {
    const picker = document.getElementById("imagePickerInput");
    if (picker) picker.click();
  },
  onImageSelected: async (file) => {
    const toDataURL = (f) =>
      new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
    try {
      state.pendingImageSrc = await toDataURL(file);
      state.tool = "image";
      setActiveToolButton("image");
      setOverlayCursor("image");
    } catch (e) {
      console.error("Failed to read image file", e);
    }
  },
  onUndo: async () => { if (undo()) await rerender(); },
  onRedo: async () => { if (redo()) await rerender(); },
  onHistoryJump: async (entryId) => {
    const target = Number(entryId);
    if (!Number.isFinite(target)) return;
    if (jumpToHistory(target)) await rerender();
  },
};

