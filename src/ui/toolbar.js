/**
 * toolbar.js
 * Purpose: Build the toolbar UI and wire button events via passed-in handlers.
 * Why: Keeps DOM creation + event binding in one place.
 */
export function createToolbar(containerId, handlers) {
  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Toolbar container #${containerId} not found`);

  el.innerHTML = `
    <button id="prevPage">◀ Prev</button>
    <span>Page <span id="pageNum">1</span> / <span id="pageCount">?</span></span>
    &nbsp;|&nbsp;
    <button id="zoomOut">−</button>
    <span id="zoomLevel">100%</span>
    <button id="zoomIn">+</button>
    &nbsp;|&nbsp;
    <button id="nextPage">Next ▶</button>
  `;

  // Bind events to external logic (controller handlers)
  document.getElementById("prevPage").addEventListener("click", handlers.onPrev);
  document.getElementById("nextPage").addEventListener("click", handlers.onNext);
  document.getElementById("zoomIn").addEventListener("click", handlers.onZoomIn);
  document.getElementById("zoomOut").addEventListener("click", handlers.onZoomOut);
}

/**
 * ui
 * Purpose: Provide references to toolbar elements so controller can update them.
 */
export const ui = {
  pageNumEl:   () => document.getElementById("pageNum"),
  pageCountEl: () => document.getElementById("pageCount"),
  zoomLevelEl: () => document.getElementById("zoomLevel"),
};

