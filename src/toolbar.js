/**
 * toolbar.js
 * Builds the toolbar UI in a clean, reusable way.
 * Usage: createToolbar("toolbar")
 */
export function createToolbar(containerId) {
  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Toolbar container #${containerId} not found`);

  el.innerHTML = `
    <button id="prevPage">◀ Prev</button>
    <span id="pageInfo">Page <span id="pageNum">1</span> / <span id="pageCount">?</span></span>
    <button id="nextPage">Next ▶</button>
    &nbsp;|&nbsp;
    <button id="zoomOut">−</button>
    <span id="zoomLevel">100%</span>
    <button id="zoomIn">+</button>
  `;
}
