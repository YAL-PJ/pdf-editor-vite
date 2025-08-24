/**
 * HTML template generation for toolbar
 */
export function createToolbarHTML() {
  return `
    <button id="prevPage">◀ Prev</button>
    <span>Page <span id="pageNum">1</span> / <span id="pageCount">?</span></span>
    &nbsp;|&nbsp;
    <button id="zoomOut">−</button>
    <span id="zoomLevel">100%</span>
    <button id="zoomIn">+</button>
    &nbsp;|&nbsp;
    <button id="nextPage">Next ▶</button>
    &nbsp;|&nbsp;
    <button id="toolSelect">↖ Select</button>
    <button id="toolHighlight">🖍 Highlight</button>
    <button id="toolNote">📝 Note</button>
  `;
}
