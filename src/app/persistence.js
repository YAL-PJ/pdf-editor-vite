/**
 * persistence.js
 * - Warn on leave (close/back/navigate) when data exists
 * - Suppress warning on refresh (F5/Ctrl/Cmd+R/Cmd+Shift+R, and programmatic reload when possible)
 * - Debounced autosave; PDF bytes in IndexedDB; metadata in sessionStorage
 * - Versioned schema; safe JSON; guarded event hooks
 */

import { state } from "./state";

/* ===== Config / constants ===== */
const META_KEY = "pdfEditorMeta:v2";
const DB_NAME  = "pdfEditorDB";
const DB_VER   = 1;
const STORE    = "pdfs";
const PDF_KEY  = "loadedPdfData";
const ENABLE_IDB = typeof indexedDB !== "undefined";

/* ===== Utils ===== */
const nowTs = () => Date.now();
const isTyping = (el) => !!el && (
  el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable
);
const hasPersistableData = () =>
  !!(state?.loadedPdfData || Object.keys(state?.annotations || {}).length);

function safeSerialize(obj) {
  const seen = new WeakSet();
  return JSON.parse(JSON.stringify(obj, (k, v) => {
    if (typeof v === "function") return undefined;
    if (v && typeof v === "object") {
      if (seen.has(v)) return undefined;
      seen.add(v);
    }
    return v;
  }));
}

/* ===== IndexedDB (vanilla) ===== */
function openDb() {
  if (!ENABLE_IDB) return Promise.reject(new Error("IndexedDB unavailable"));
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

function idbPut(key, value) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function idbGet(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

function idbDelete(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

/* ===== Metadata (sessionStorage) ===== */
function writeMetaSync() {
  try {
    const annotations = state?.annotations || {};
    const meta = {
      ver: 2,
      savedAt: nowTs(),
      hasPdf: !!state?.loadedPdfData,
      annotations, // keep human-readable
    };
    sessionStorage.setItem(META_KEY, JSON.stringify(meta));
    return true;
  } catch (e) {
    console.error("writeMetaSync failed:", e);
    return false;
  }
}

function readMetaSync() {
  try {
    const raw = sessionStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("readMetaSync failed:", e);
    return null;
  }
}

/* ===== Public save/load API ===== */

/** Debounced autosave for frequent edits */
let _saveTimeout = null;
export function scheduleSave(delayMs = 200) {
  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(() => { _saveTimeout = null; void saveState(); }, delayMs);
}

/** Persist metadata (sync) + PDF bytes (async to IDB) */
export async function saveState() {
  writeMetaSync();
  try {
    if (ENABLE_IDB && state?.loadedPdfData) {
      const buf = state.loadedPdfData.buffer.slice(
        state.loadedPdfData.byteOffset,
        state.loadedPdfData.byteOffset + state.loadedPdfData.byteLength
      );
      await idbPut(PDF_KEY, buf);
    }
  } catch (e) {
    console.error("saveState: IDB write failed:", e);
  }
}

/** Restore state from storage */
export async function loadState() {
  const meta = readMetaSync();
  if (!meta || (meta.ver !== 2 && meta.ver !== 1)) return false;

  try {
    state.annotations = meta.annotations || {};
    if ((meta.hasPdf || meta.hasPdf === undefined) && ENABLE_IDB) {
      const buf = await idbGet(PDF_KEY);
      if (buf instanceof ArrayBuffer) {
        state.loadedPdfData = new Uint8Array(buf);
      } else if (buf?.buffer instanceof ArrayBuffer) {
        state.loadedPdfData = new Uint8Array(buf.buffer);
      } else {
        state.loadedPdfData = null;
      }
    } else {
      state.loadedPdfData = null;
    }
    return !!(state.loadedPdfData || Object.keys(state.annotations || {}).length);
  } catch (e) {
    console.error("loadState failed:", e);
    return false;
  }
}

/** Clear everything we persisted */
export async function clearSavedState() {
  try { sessionStorage.removeItem(META_KEY); } catch {}
  try { if (ENABLE_IDB) await idbDelete(PDF_KEY); } catch {}
}

/* ===== Unload warning (suppress on refresh only) ===== */

let _unloadInit = false;
let _isLikelyRefresh = false;

function markRefreshIntent() {
  _isLikelyRefresh = true;
  try { sessionStorage.setItem("__refreshIntent", "1"); } catch {}
}

/* Keyboard refresh detection (covers most cases) */
document.addEventListener("keydown", (e) => {
  if (isTyping(e.target)) return;
  const key = (e.key || "").toLowerCase();
  if (
    key === "f5" ||
    (e.ctrlKey && key === "r") ||
    (e.metaKey && key === "r") ||
    (e.metaKey && e.shiftKey && key === "r") // hard refresh on mac
  ) {
    markRefreshIntent();
  }
});

/* Try to wrap programmatic reload if writable/configurable; otherwise skip */
(function tryWrapReload() {
  try {
    const loc = window.location;
    if (!loc) return;
    const proto = Object.getPrototypeOf(loc);
    const desc = Object.getOwnPropertyDescriptor(proto, "reload") ||
                 Object.getOwnPropertyDescriptor(loc, "reload");
    if (desc && (desc.writable || desc.configurable)) {
      const orig = loc.reload.bind(loc);
      Object.defineProperty(loc, "reload", {
        configurable: desc.configurable !== false,
        enumerable: !!desc.enumerable,
        writable: desc.writable !== false,
        value: function(...args) {
          markRefreshIntent();
          return orig(...args);
        }
      });
    }
    // If not writable/configurable, we don't patch (no error).
  } catch {
    // ignore – some engines throw on introspection
  }
})();

/**
 * Initialize unload behavior:
 * - Save early on backgrounding
 * - Warn on leave if data exists AND it's not (likely) a refresh
 */
export function initUnloadWarning() {
  if (_unloadInit) return;
  _unloadInit = true;

  // Save early when tab backgrounds (gives IDB time)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && hasPersistableData()) {
      void saveState();
    }
  });

  // Save on pagehide (BFCache-friendly)
  window.addEventListener("pagehide", () => {
    if (hasPersistableData()) {
      void saveState();
    }
  });

  // Warn on leave unless we detected refresh intent
  window.addEventListener("beforeunload", (e) => {
    if (!hasPersistableData()) return;

    // Fast meta write so the next load can restore
    writeMetaSync();

    let refreshIntent = _isLikelyRefresh;
    try {
      if (sessionStorage.getItem("__refreshIntent") === "1") refreshIntent = true;
    } catch {}

    if (!refreshIntent) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    } else {
      // Clear marker so subsequent leaves warn again
      _isLikelyRefresh = false;
      try { sessionStorage.removeItem("__refreshIntent"); } catch {}
    }
  });

  // After load, clear any stale refresh markers
  window.addEventListener("load", () => {
    _isLikelyRefresh = false;
    try { sessionStorage.removeItem("__refreshIntent"); } catch {}
  });
}

/** Expose for SPA guards if needed */
export function hasDataToLose() { return hasPersistableData(); }
