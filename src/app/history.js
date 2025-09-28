// src/app/history.js
import { state, markAnnotationsChanged } from "@app/state";

const MAX = 100;
const HISTORY_UPDATED_EVENT = "history:updated";

const isBrowserEnv = typeof document !== "undefined" && document !== null;

/**
 * Module-level store that owns the entire undo/redo timeline.
 * All mutations should go through the helpers in this module so
 * every consumer reads a consistent view of the history state.
 */
const historyState = {
  counter: 0,
  entries: [],
  cursor: -1,
  pendingLabel: null,
};

const toHistoryEntry = (entry, type) => ({
  id: entry.id,
  label: entry.label,
  timestamp: entry.timestamp,
  type,
});

function deepClone(obj) {
  if (obj === undefined) return undefined;
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function takeSnapshot() {
  return {
    pageNum: state.pageNum,
    scale: state.scale,
    annotations: deepClone(state.annotations || {}),
  };
}

function restoreSnapshot(entry) {
  if (!entry) return;
  const snap = entry.snapshot;
  state.pageNum = snap.pageNum;
  state.scale = snap.scale;
  state.annotations = deepClone(snap.annotations || {});
  markAnnotationsChanged();
}

const notifyHistoryUpdated = () => {
  if (!isBrowserEnv) return;
  document.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT));
};

const ensurePresentEntry = () => {
  if (historyState.entries.length) return;
  const entry = createEntry();
  historyState.entries.push(entry);
  historyState.cursor = 0;
};

const trimExcessPast = () => {
  if (historyState.cursor <= MAX) return;
  const overflow = historyState.cursor - MAX;
  historyState.entries.splice(0, overflow);
  historyState.cursor -= overflow;
};

function createEntry(label) {
  const snapshot = takeSnapshot();
  const id = ++historyState.counter;
  const entryLabel = label || (id === 1 ? "Initial state" : `Edit ${id}`);
  return {
    id,
    label: entryLabel,
    timestamp: Date.now(),
    snapshot,
  };
}

export function historyInit(label = "Initial state") {
  historyState.entries = [];
  historyState.cursor = -1;
  historyState.counter = 0;
  historyState.pendingLabel = null;
  const entry = createEntry(label);
  historyState.entries.push(entry);
  historyState.cursor = 0;
  notifyHistoryUpdated();
}

export function historyBegin(label) {
  ensurePresentEntry();
  historyState.pendingLabel = label || null;
}

export function historyCommit(label) {
  ensurePresentEntry();
  historyState.entries = historyState.entries.slice(0, historyState.cursor + 1);
  const entry = createEntry(label || historyState.pendingLabel || null);
  historyState.entries.push(entry);
  historyState.cursor = historyState.entries.length - 1;
  trimExcessPast();
  historyState.pendingLabel = null;
  notifyHistoryUpdated();
}

export function undo() {
  if (historyState.cursor <= 0) return false;
  historyState.cursor -= 1;
  const entry = historyState.entries[historyState.cursor];
  restoreSnapshot(entry);
  historyState.pendingLabel = null;
  notifyHistoryUpdated();
  return true;
}

export function redo() {
  if (historyState.cursor < 0) return false;
  if (historyState.cursor >= historyState.entries.length - 1) return false;
  historyState.cursor += 1;
  const entry = historyState.entries[historyState.cursor];
  restoreSnapshot(entry);
  historyState.pendingLabel = null;
  notifyHistoryUpdated();
  return true;
}

export function getHistoryTimeline() {
  if (!historyState.entries.length) {
    return {
      past: [],
      present: null,
      future: [],
    };
  }

  const pastEntries = historyState.entries
    .slice(0, historyState.cursor)
    .map((entry) => toHistoryEntry(entry, "past"));
  const presentEntry =
    historyState.cursor >= 0
      ? toHistoryEntry(historyState.entries[historyState.cursor], "present")
      : null;
  const futureEntries = historyState.entries
    .slice(historyState.cursor + 1)
    .map((entry) => toHistoryEntry(entry, "future"));

  return {
    past: pastEntries,
    present: presentEntry,
    future: futureEntries,
  };
}

export function jumpToHistory(entryId) {
  if (typeof entryId !== "number") return false;
  const index = historyState.entries.findIndex((entry) => entry.id === entryId);
  if (index === -1) return false;
  if (index === historyState.cursor) return true;

  historyState.cursor = index;
  const entry = historyState.entries[historyState.cursor];
  restoreSnapshot(entry);
  historyState.pendingLabel = null;
  notifyHistoryUpdated();
  return true;
}

export function getHistoryEntries() {
  if (!historyState.entries.length) return [];

  const pastEntries = historyState.entries
    .slice(0, historyState.cursor)
    .reverse()
    .map((entry) => toHistoryEntry(entry, "past"));
  const presentEntry =
    historyState.cursor >= 0
      ? [toHistoryEntry(historyState.entries[historyState.cursor], "present")]
      : [];
  const futureEntries = historyState.entries
    .slice(historyState.cursor + 1)
    .map((entry) => toHistoryEntry(entry, "future"));

  return [...pastEntries, ...presentEntry, ...futureEntries];
}

export { HISTORY_UPDATED_EVENT };
