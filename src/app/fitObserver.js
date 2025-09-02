// File: src/app/fitObserver.js
/**
 * fitObserver.js
 * Refit PDF when the viewer resizes (split view, devtools, window resize).
 * - Debounced (rAF) and width-change gated to avoid extra work
 * - No CLS: rerender() handles size-first + crisp drawing
 */

import { state } from "@app/state";

function rafDebounce(fn) {
  let id = 0;
  return (...args) => {
    if (id) return;
    id = requestAnimationFrame(() => {
      id = 0;
      fn(...args);
    });
  };
}

export function initFitObserver(getViewerEl, rerender) {
  let lastWidth = 0;

  const onResize = rafDebounce((entry) => {
    if (!state.pdfDoc) return;               // nothing open
    const viewer = getViewerEl?.();
    if (!viewer) return;

    const w = Math.round(viewer.clientWidth || 0);
    if (!w || w === lastWidth) return;       // no effective change

    lastWidth = w;
    void rerender();                         // size-first, CLS-safe render path
  });

  // Initial width snapshot (if available)
  try {
    const v = getViewerEl?.();
    if (v) lastWidth = Math.round(v.clientWidth || 0);
  } catch {}

  const ro = new ResizeObserver((entries) => {
    // Use the first entry; this container is stable
    const entry = entries[0];
    onResize(entry);
  });

  const viewer = getViewerEl?.();
  if (viewer) ro.observe(viewer);

  // Also react to DPR changes (retina zoom) & orientation changes
  const media = matchMedia("(resolution: 2dppx)");
  const onDpr = () => {
    if (!state.pdfDoc) return;
    void rerender();
  };
  try { media.addEventListener?.("change", onDpr); } catch {}
  window.addEventListener("orientationchange", onDpr);

  // HMR-safe teardown
  if (import.meta?.hot) {
    import.meta.hot.dispose(() => {
      try { ro.disconnect(); } catch {}
      try { media.removeEventListener?.("change", onDpr); } catch {}
      window.removeEventListener("orientationchange", onDpr);
    });
  }

  return {
    disconnect() {
      try { ro.disconnect(); } catch {}
      try { media.removeEventListener?.("change", onDpr); } catch {}
      window.removeEventListener("orientationchange", onDpr);
    }
  };
}
