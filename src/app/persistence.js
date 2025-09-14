/**
 * persistence.js
 * - Warn on leave (close/back/navigate) when data exists
 * - Suppress warning on refresh (F5/Ctrl/Cmd+R/Cmd+Shift+R, and programmatic reload when possible)
 * - Debounced autosave; PDF bytes in IndexedDB; metadata in sessionStorage
 * - Versioned schema; safe JSON; guarded event hooks
 * - OPTIMIZED: Non-blocking saves to prevent performance violations
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

// Use version if available; fall back to count for older states
function getAnnoVersion() {
  const v = state?.annotationsVersion ?? 0;
  return (Number.isFinite(v) && v > 0) ? v : Object.keys(state?.annotations || {}).length;
}

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
let _dbPromise = null;
function openDb() {
  if (!ENABLE_IDB) return Promise.reject(new Error("IndexedDB unavailable"));
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
  return _dbPromise;
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
      annoVer: getAnnoVersion(),
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

/* ===== Optimized save operations ===== */

// Cache to avoid redundant saves
let _lastMetaSnapshot = null;
let _pendingIdbSave = null;
let _pendingMetaSave = null;

/** Ultra-fast metadata save using background task */
function saveMetaOnly() {
  // Quick dirty check first
  const quickSnapshot = `${getAnnoVersion()}:${!!state?.loadedPdfData}`;
  
  if (quickSnapshot === _lastMetaSnapshot) return true;
  
  // Cancel any pending meta save
  if (_pendingMetaSave) {
    _pendingMetaSave.cancelled = true;
  }
  
  const metaOperation = { cancelled: false };
  _pendingMetaSave = metaOperation;
  
  // Use scheduler for metadata save too
  const scheduleMetaWork = (fn) => {
    if (typeof scheduler !== 'undefined' && scheduler.postTask) {
      return scheduler.postTask(fn, { priority: 'user-blocking' });
    }
    return new Promise(resolve => setTimeout(() => resolve(fn()), 0));
  };
  
  scheduleMetaWork(() => {
    if (metaOperation.cancelled) return;
    
    try {
      const success = writeMetaSync();
      if (success && !metaOperation.cancelled) {
        _lastMetaSnapshot = quickSnapshot;
      }
    } catch (e) {
      console.error("Async meta save failed:", e);
    }
  });
  
  return true;
}

/** Synchronous metadata save for critical situations */
function saveMetaCritical() {
  const quickSnapshot = `${getAnnoVersion()}:${!!state?.loadedPdfData}`;
  
  if (quickSnapshot === _lastMetaSnapshot) return true;
  
  const success = writeMetaSync();
  if (success) _lastMetaSnapshot = quickSnapshot;
  return success;
}

/** Background PDF save (async, non-blocking) */
function savePdfInBackground() {
  if (!ENABLE_IDB || !state?.loadedPdfData) return Promise.resolve();
  
  // Cancel pending save if one exists
  if (_pendingIdbSave) {
    _pendingIdbSave.cancelled = true;
  }
  
  const saveOperation = {
    cancelled: false,
    promise: null
  };
  _pendingIdbSave = saveOperation;
  
  // Use scheduler.postTask if available for better performance
  const scheduleWork = (fn) => {
    if (typeof scheduler !== 'undefined' && scheduler.postTask) {
      return scheduler.postTask(fn, { priority: 'background' });
    }
    return new Promise(resolve => setTimeout(() => resolve(fn()), 0));
  };
  
  saveOperation.promise = scheduleWork(async () => {
    if (saveOperation.cancelled) return;
    
    try {
      const buf = state.loadedPdfData.buffer.slice(
        state.loadedPdfData.byteOffset,
        state.loadedPdfData.byteOffset + state.loadedPdfData.byteLength
      );
      
      if (!saveOperation.cancelled) {
        await idbPut(PDF_KEY, buf);
      }
    } catch (e) {
      if (!saveOperation.cancelled) {
        console.error("Background PDF save failed:", e);
      }
    }
  });
  
  return saveOperation.promise;
}

/* ===== Public save/load API ===== */

/** Debounced autosave for frequent edits */
let _saveTimeout = null;
export function scheduleSave(delayMs = 200) {
  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(() => { 
    _saveTimeout = null; 
    void saveState(); 
  }, delayMs);
}

/** Fast save: immediate metadata + background PDF */
export async function saveState() {
  // Always save metadata immediately (fast)
  saveMetaOnly();
  
  // Save PDF in background (non-blocking)
  return savePdfInBackground();
}

/** Critical save: ensure both metadata and PDF are saved */
export async function saveStateSync() {
  saveMetaOnly();
  try {
    if (ENABLE_IDB && state?.loadedPdfData) {
      const buf = state.loadedPdfData.buffer.slice(
        state.loadedPdfData.byteOffset,
        state.loadedPdfData.byteOffset + state.loadedPdfData.byteLength
      );
      await idbPut(PDF_KEY, buf);
    }
  } catch (e) {
    console.error("saveStateSync: IDB write failed:", e);
  }
}

/** Restore state from storage */
export async function loadState() {
  const meta = readMetaSync();
  if (!meta || (meta.ver !== 2 && meta.ver !== 1)) return false;

  try {
    state.annotations = meta.annotations || {};
    if (typeof meta.annoVer === "number") {
      try { state.annotationsVersion = meta.annoVer; } catch {}
    } else {
      try { state.annotationsVersion = Object.keys(state.annotations||{}).length; } catch {}
    }
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
  _lastMetaSnapshot = null;
  if (_pendingIdbSave) {
    _pendingIdbSave.cancelled = true;
    _pendingIdbSave = null;
  }
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
    // ignore - some engines throw on introspection
  }
})();

/**
 * Initialize unload behavior:
 * - Save metadata immediately on backgrounding (fast)
 * - Save PDF in background for better performance
 * - Warn on leave if data exists AND it's not (likely) a refresh
 */
export function initUnloadWarning() {
  if (_unloadInit) return;
  _unloadInit = true;

  // OPTIMIZED: Only save metadata immediately, PDF in background
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && hasPersistableData()) {
      // Fast metadata save (no performance violation)
      saveMetaOnly();
      // PDF save in background (non-blocking)
      savePdfInBackground();
    }
  });

  // Save on pagehide (BFCache-friendly) - use critical save for page unload
  window.addEventListener("pagehide", (e) => {
    if (hasPersistableData()) {
      // Use synchronous save for critical unload situations
      saveMetaOnly();
      // For pagehide, we can't wait for async operations anyway
      if (e.persisted) {
        // Page is going into BFCache, start background save
        savePdfInBackground();
      }
    }
  });

  // Warn on leave unless we detected refresh intent
  window.addEventListener("beforeunload", (e) => {
    if (!hasPersistableData()) return;

    // Require a real user gesture in this frame (Chrome policy)
    const ua = navigator.userActivation;
    const hadGesture = !!(ua?.isActive || ua?.hasBeenActive);
    if (!hadGesture) return;

    // Fast meta write so the next load can restore
    saveMetaOnly();

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

