// src/app/handlerWrapper.js
import { historyBegin, historyCommit } from "@app/history";
import { scheduleSave } from "@app/persistence";

const SKIP_HISTORY_HANDLERS = new Set([
  "onUndo",
  "onRedo",
  "onHistoryJump",
  "onPrev",
  "onNext",
  "onZoomIn",
  "onZoomOut",
  "onZoomFit",
  "onZoomInput",
  "onPageInput",
  "onToolChange",
  "onPickImage",
  "onImageSelected",
]);

/**
 * Wrap a state-mutating handler with history + autosave.
 * - Begins a history step
 * - Commits & schedules save ONLY on success
 * - Never commits on throw/reject
 */
export const wrapHandler = (name, fn) => {
  if (SKIP_HISTORY_HANDLERS.has(name)) return fn;

  return (...args) => {
    historyBegin(name);
    try {
      const out = fn?.(...args);
      if (out && typeof out.then === "function") {
        return out
          .then((value) => {
            historyCommit(name);
            scheduleSave();
            return value;
          })
          .catch((error) => {
            throw error;
          });
      }
      historyCommit(name);
      scheduleSave();
      return out;
    } catch (error) {
      throw error;
    }
  };
};

