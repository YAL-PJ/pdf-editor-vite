// src/app/utils/state.js
import { state } from "@app/state";

/** Fast deep clone for plain JSON-like objects */
function deepClone(obj) {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Ensure state.annotations exists and return a brand-new, MUTABLE array
 * for the given page. If an old bucket exists but is frozen/non-extensible,
 * we deep-clone its items into a fresh array so nested objects are mutable too.
 */
export function ensureMutablePageAnnotations(pageNum) {
  // Ensure root is present & mutable (replace if frozen)
  if (!state.annotations || !Object.isExtensible(state.annotations) || Object.isFrozen(state.annotations)) {
    state.annotations = deepClone(state.annotations || {});
  }

  const existing = state.annotations[pageNum];

  // 1) No bucket yet → create empty mutable array
  if (!Array.isArray(existing)) {
    const fresh = [];
    state.annotations[pageNum] = fresh;
    return fresh;
  }

  // 2) Has a bucket but it's non-extensible/frozen → deep-clone items to new array
  if (!Object.isExtensible(existing) || Object.isFrozen(existing)) {
    const fresh = existing.map(deepClone); // also unfreezes nested objects (e.g., rect arrays)
    state.annotations[pageNum] = fresh;
    return fresh;
  }

  // 3) Normal mutable array → return as-is
  return existing;
}
