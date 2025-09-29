/**
 * state.js
 * Centralized app state + safe setters (no freezing)
 */

// ---- Core state ----
export const state = {
  pdfDoc: null,
  loadedPdfData: null,  // Uint8Array of the raw PDF
  pageNum: 1,
  scale: 1.0,

  // "pan" | "highlight" | "text-highlight" | "note" | "text" | "image" | null
  tool: null,

  // { [pageNum: number]: Annotation[] }
  // highlight: {
  //   type:'highlight',
  //   rect:[x,y,w,h],
  //   rects?: [ [x,y,w,h], ... ],
  //   anchors?: { page:number|null, start:{ spanId:string|null, charOffset:number, charStart:number, charEnd:number, localOffset:number }, end:{ ... } },
  //   source?: 'freeform'|'text',
  //   text?: string,
  //   createdAt?: number
  // }
  // note:      { type:'note',      pos:[x,y], text:string }
  // text:      { type:'text',      rect:[x,y,w,h], text:string, fontSize:number, color:string, align:'left'|'center'|'right' }
  // image:     { type:'image',     rect:[x,y,w,h], src:string }  // src is a dataURL
  annotations: {},
  // Bumped on ANY annotation mutation; used for persistence snapshots
  annotationsVersion: 0,

  // Per-page PDF.js viewports
  viewports: {},

  pendingImageSrc: null, // dataURL of the image just picked (awaiting placement)
};

// ---- Version bump helper ----
export function markAnnotationsChanged() {
  state.annotationsVersion = (state.annotationsVersion || 0) + 1;
  return state.annotationsVersion;
}

// ---- Safe getters/setters for annotations container ----

/**
 * Replace the whole annotations map immutably.
 * Used by render.js when it can't mutate the original container.
 */
export function setAnnotations(nextAnnotations) {
  // Defensive copy to avoid accidentally sharing a frozen object
  const out = {};
  if (nextAnnotations && typeof nextAnnotations === "object") {
    for (const k of Object.keys(nextAnnotations)) {
      const list = nextAnnotations[k];
      out[k] = Array.isArray(list) ? list.slice() : [];
    }
  }
  state.annotations = out;
  state.annotationsVersion = (state.annotationsVersion || 0) + 1;
  return state.annotations;
}

/** Read only — returns [] when page doesn't exist */
export function getPageAnnotations(pageNum) {
  const list = state.annotations?.[pageNum];
  return Array.isArray(list) ? list : [];
}

/**
 * Set a single page’s annotations immutably.
 * Accepts any iterable of annotations; stores a shallow copy.
 */
export function setPageAnnotations(pageNum, list) {
  const prev = state.annotations || {};
  const next = { ...prev, [pageNum]: Array.isArray(list) ? list.slice() : [] };
  state.annotations = next;
  state.annotationsVersion = (state.annotationsVersion || 0) + 1;
  return state.annotations[pageNum];
}

// ---- Optional convenience helpers (used by some UIs) ----

/** Add an annotation to a page (immutable container update) */
export function addAnnotation(pageNum, ann) {
  const current = getPageAnnotations(pageNum);
  const next = current.concat([ann]);
  return setPageAnnotations(pageNum, next);
}

/** Replace an annotation object on a page by identity (immutable container update) */
export function replaceAnnotation(pageNum, oldAnn, patch) {
  const current = getPageAnnotations(pageNum);
  const i = current.indexOf(oldAnn);
  if (i < 0) return current;
  const updated = { ...oldAnn, ...patch };
  const next = current.slice();
  next.splice(i, 1, updated);
  setPageAnnotations(pageNum, next);
  return updated;
}

/** Remove an annotation from a page by identity (immutable container update) */
export function removeAnnotation(pageNum, ann) {
  const current = getPageAnnotations(pageNum);
  const i = current.indexOf(ann);
  if (i < 0) return current;
  const next = current.slice();
  next.splice(i, 1);
  return setPageAnnotations(pageNum, next);
}

// ---- Other small setters (optional) ----

export function setTool(tool) { state.tool = tool; return state.tool; }
export function setScale(scale) { state.scale = scale; return state.scale; }
export function setPageNum(n) { state.pageNum = n; return state.pageNum; }
export function setViewport(pageNum, viewport) {
  state.viewports = { ...state.viewports, [pageNum]: viewport };
  return state.viewports[pageNum];
}
export function setPendingImageSrc(src) { state.pendingImageSrc = src; return state.pendingImageSrc; }
