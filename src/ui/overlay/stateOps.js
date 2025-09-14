// src/ui/overlay/stateOps.js
import { state, markAnnotationsChanged } from "@app/state";

export function getPageList(pageNum) {
  const anns = state.annotations || {};
  const page = anns[pageNum];
  return Array.isArray(page) ? page : [];
}

export function setPageList(pageNum, newList) {
  const prevAnns = state.annotations || {};
  const pageCopy = Array.isArray(newList) ? newList.slice() : [];
  const nextAnns = { ...prevAnns, [pageNum]: pageCopy };
  try { state.annotations = nextAnns; }
  catch {
    if (typeof state.setAnnotations === "function") state.setAnnotations(nextAnns);
    else console.warn("[render] annotations container is read-only; updates may not persist.");
  }
  markAnnotationsChanged();`n  return getPageList(pageNum);
}

export function replaceAnn(pageNum, oldAnn, patch) {
  const pageList = getPageList(pageNum);
  const i = pageList.indexOf(oldAnn);
  if (i < 0) return oldAnn;
  const updated = { ...oldAnn, ...patch };
  const nextList = pageList.slice();
  nextList.splice(i, 1, updated);
  setPageList(pageNum, nextList);
  return updated;
}

export function removeAnn(pageNum, ann) {
  const pageList = getPageList(pageNum);
  const i = pageList.indexOf(ann);
  if (i < 0) return;
  const nextList = pageList.slice();
  nextList.splice(i, 1);
  setPageList(pageNum, nextList);
}


