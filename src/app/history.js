// src/app/history.js
import { produce } from "immer";
import { state, markAnnotationsChanged } from "@app/state";

const MAX = 100;
const HISTORY_UPDATED_EVENT = "history:updated";

let counter = 0;
let past = [];
let future = [];
let present = null;
let pendingLabel = null;

function takeSnapshot() {
  return {
    pageNum: state.pageNum,
    scale: state.scale,
    annotations: produce(state.annotations || {}, (draft) => draft),
  };
}

function deepClone(obj) {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function restoreSnapshot(entry) {
  if (!entry) return;
  const snap = entry.snapshot;
  state.pageNum = snap.pageNum;
  state.scale = snap.scale;
  state.annotations = deepClone(snap.annotations || {});
  markAnnotationsChanged();
}

function notifyHistoryUpdated() {
  if (typeof document !== "undefined" && document) {
    document.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT));
  }
}

function createEntry(label) {
  const snapshot = takeSnapshot();
  const id = ++counter;
  const entryLabel = label || (id === 1 ? "Initial state" : `Edit ${id}`);
  return {
    id,
    label: entryLabel,
    timestamp: Date.now(),
    snapshot,
  };
}

export function historyInit(label = "Initial state") {
  past = [];
  future = [];
  counter = 0;
  pendingLabel = null;
  present = createEntry(label);
  notifyHistoryUpdated();
}

export function historyBegin(label) {
  if (!present) present = createEntry();
  past.push(present);
  if (past.length > MAX) past.shift();
  pendingLabel = label || null;
}

export function historyCommit(label) {
  present = createEntry(label || pendingLabel || null);
  future.length = 0;
  pendingLabel = null;
  notifyHistoryUpdated();
}

export function undo() {
  if (!past.length) return false;
  future.unshift(present);
  present = past.pop();
  restoreSnapshot(present);
  pendingLabel = null;
  notifyHistoryUpdated();
  return true;
}

export function redo() {
  if (!future.length) return false;
  past.push(present);
  present = future.shift();
  restoreSnapshot(present);
  pendingLabel = null;
  notifyHistoryUpdated();
  return true;
}

export function getHistoryTimeline() {
  const map = (entry, type) => ({
    id: entry.id,
    label: entry.label,
    timestamp: entry.timestamp,
    type,
  });
  return {
    past: past.map((entry) => map(entry, "past")),
    present: present ? map(present, "present") : null,
    future: future.map((entry) => map(entry, "future")),
  };
}

export function jumpToHistory(entryId) {
  if (!present || typeof entryId !== "number") return false;
  if (present.id === entryId) return true;

  const pastIndex = past.findIndex((entry) => entry.id === entryId);
  if (pastIndex >= 0) {
    while (present.id !== entryId && past.length) {
      future.unshift(present);
      present = past.pop();
    }
    restoreSnapshot(present);
    notifyHistoryUpdated();
    return true;
  }

  const futureIndex = future.findIndex((entry) => entry.id === entryId);
  if (futureIndex >= 0) {
    while (present.id !== entryId && future.length) {
      past.push(present);
      present = future.shift();
    }
    restoreSnapshot(present);
    notifyHistoryUpdated();
    return true;
  }

  return false;
}

export { HISTORY_UPDATED_EVENT };
