// src/app/handlerWrapper.js
import { historyBegin, historyCommit } from "@app/history";
import { scheduleSave } from "@app/persistence";

/**
 * Wrap a state-mutating handler with history + autosave.
 * - Begins a history step
 * - Commits & schedules save ONLY on success
 * - Never commits on throw/reject
 */
export const wrapHandler = (name, fn) => {
  const skip = new Set(["onUndo", "onRedo"]);
  if (skip.has(name)) return fn;

  return (...args) => {
    historyBegin();
    try {
      const out = fn?.(...args);
      if (out && typeof out.then === "function") {
        return out.then((v) => {
          historyCommit();
          scheduleSave();
          return v;
        }).catch((e) => {
          // No commit on failure
          throw e;
        });
      }
      historyCommit();
      scheduleSave();
      return out;
    } catch (e) {
      // No commit on failure
      throw e;
    }
  };
};
