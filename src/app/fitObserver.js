// File: src/app/fitObserver.js
/**
 * fitObserver.js
 * Refit PDF when the *container* resizes (split view, devtools, window resize).
 * - Observe a stable element (e.g., `.viewer-scroll`) to avoid feedback loops
 * - Debounced via rAF and width-change gated to avoid extra work
 * - No CLS: rerender() handles size-first + crisp drawing
 */

import { state } from "@app/state";

function rafDebounce(fn) {
  let scheduled = false;
  return (...args) => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn(...args);
    });
  };
}

// Extract width from ResizeObserverEntry with fallbacks
function entryWidth(entry, fallbackEl) {
  try {
    if (entry?.contentBoxSize) {
      const size = Array.isArray(entry.contentBoxSize)
        ? entry.contentBoxSize[0]
        : entry.contentBoxSize;
      if (size?.inlineSize) return Math.round(size.inlineSize);
    }
    if (entry?.contentRect?.width) return Math.round(entry.contentRect.width);
  } catch {}
  return Math.round(fallbackEl?.clientWidth || 0);
}

/**
 * @param {() => HTMLElement|null|undefined} getContainerEl - returns the element to observe
 * @param {() => (void|Promise<void>)} rerender - rerender function
 * @returns {{disconnect: () => void}}
 */
export function initFitObserver(getContainerEl, rerender) {
  let lastWidth = 0;

  const onResize = rafDebounce((entry) => {
    if (!state.pdfDoc) return; // nothing open
    const el = getContainerEl?.();
    if (!el) return;

    const w = Math.max(0, entryWidth(entry, el));
    if (!w || w === lastWidth) return; // no effective change

    lastWidth = w;
    void rerender(); // size-first, CLS-safe render path
  });

  // Observe the current container
  const container = getContainerEl?.();
  if (!container) {
    console.warn("[fitObserver] No container element to observe");
    return { disconnect() {} };
  }

  // Initial snapshot to suppress first no-op callback
  try { lastWidth = Math.round(container.clientWidth || 0); } catch {}

  const ro = new ResizeObserver((entries) => {
    // Use the last entry (coalesced) for accuracy
    const entry = entries[entries.length - 1];
    onResize(entry);
  });
  ro.observe(container);

  // React to device pixel ratio & orientation changes
  const onDprOrOrientation = () => {
    if (!state.pdfDoc) return;
    void rerender();
  };

  // DPR listener (browser support may vary)
  let media;
  try {
    media = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    media.addEventListener?.("change", onDprOrOrientation);
  } catch {}

  window.addEventListener("orientationchange", onDprOrOrientation);

  // HMR-safe teardown
  if (import.meta?.hot) {
    import.meta.hot.dispose(() => {
      try { ro.disconnect(); } catch {}
      try { media?.removeEventListener?.("change", onDprOrOrientation); } catch {}
      window.removeEventListener("orientationchange", onDprOrOrientation);
    });
  }

  return {
    disconnect() {
      try { ro.disconnect(); } catch {}
      try { media?.removeEventListener?.("change", onDprOrOrientation); } catch {}
      window.removeEventListener("orientationchange", onDprOrOrientation);
    },
  };
}
