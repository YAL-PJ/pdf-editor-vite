// src/app/history.js
import { produce } from "immer";
import { state, markAnnotationsChanged } from "@app/state";

/** Efficient, shared snapshot via Immer */
function takeSnapshot() {
  return {
    pageNum: state.pageNum,
    scale: state.scale,
    // produce() builds an immutable tree with structural sharing
    annotations: produce(state.annotations || {}, (d) => d),
  };
}

/** Deep clone so the restored live state is MUTABLE */
function deepClone(obj) {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function restoreSnapshot(snap) {
  if (!snap) return;
  state.pageNum = snap.pageNum;
  state.scale   = snap.scale;
  state.annotations = deepClone(snap.annotations || {});
  markAnnotationsChanged();
}

const MAX = 100;
let past = [];
let future = [];
let present = null;

export function historyInit() {
  past.length = 0;
  future.length = 0;
  present = takeSnapshot();
}

// Call BEFORE a state change
export function historyBegin() {
  if (!present) present = takeSnapshot();
  past.push(present);
  if (past.length > MAX) past.shift();
}

// Call AFTER a state change
export function historyCommit() {
  present = takeSnapshot();
  future.length = 0; // new branch + clear redo
}

export function undo() {
  if (!past.length) return false;
  future.unshift(present);
  present = past.pop();
  restoreSnapshot(present);
  return true;
}

export function redo() {
  if (!future.length) return false;
  past.push(present);
  present = future.shift();
  restoreSnapshot(present);
  return true;
}

