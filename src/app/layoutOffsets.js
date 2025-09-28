/**
 * layoutOffsets.js
 * Keeps CSS custom properties in sync with the heights of fixed header, toolbar, and footer.
 */

const ROOT = typeof document !== "undefined" ? document.documentElement : null;

function setOffset(name, value) {
  if (!ROOT) return;
  ROOT.style.setProperty(name, `${value}px`);
}

function measure(el) {
  return el ? el.offsetHeight || 0 : 0;
}

function update() {
  if (!ROOT || typeof window === "undefined") return;

  const header = document.querySelector(".viewer-header");
  const toolbar = document.querySelector(".toolbar-row");
  const footer = document.querySelector(".site-footer");

  const headerH = measure(header);
  const toolbarH = measure(toolbar);
  const footerH = measure(footer);

  setOffset("--viewer-header-height", headerH);
  setOffset("--toolbar-row-height", toolbarH);
  setOffset("--footer-height", footerH);
  setOffset("--fixed-top-gap", headerH + toolbarH);
  setOffset("--fixed-bottom-gap", footerH);
}

export function initLayoutOffsets() {
  const win = typeof window !== "undefined" ? window : null;
  if (!ROOT || !win) {
    update();
    return () => {};
  }

  win.__layoutOffsetsCleanup?.();

  const elements = [
    document.querySelector(".viewer-header"),
    document.querySelector(".toolbar-row"),
    document.querySelector(".site-footer"),
  ].filter(Boolean);

  let ro = null;
  if (typeof ResizeObserver !== "undefined" && elements.length) {
    ro = new ResizeObserver(() => update());
    elements.forEach((el) => ro?.observe(el));
  }

  win.addEventListener("load", update, { passive: true });
  win.addEventListener("resize", update, { passive: true });
  update();

  const cleanup = () => {
    win.removeEventListener("load", update);
    win.removeEventListener("resize", update);
    ro?.disconnect();
  };

  win.__layoutOffsetsCleanup = cleanup;

  if (import.meta?.hot) {
    import.meta.hot.dispose(() => {
      cleanup();
      if (win.__layoutOffsetsCleanup === cleanup) {
        delete win.__layoutOffsetsCleanup;
      }
    });
  }

  return cleanup;
}

export function updateLayoutOffsets() {
  update();
}
