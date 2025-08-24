/**
 * toolbar.js
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
    &nbsp;|&nbsp;
    <button id="toolSelect">↖ Select</button>
    <button id="toolHighlight">🖍 Highlight</button>
    <button id="toolNote">📝 Note</button>
  `;

  // tool wiring
document.getElementById("toolSelect").addEventListener("click", () => handlers.onToolChange(null));
document.getElementById("toolHighlight").addEventListener("click", () => handlers.onToolChange("highlight"));
document.getElementById("toolNote").addEventListener("click", () => handlers.onToolChange("note"));

  // Navigation & zoom
  document.getElementById("prevPage").addEventListener("click", handlers.onPrev);
  document.getElementById("nextPage").addEventListener("click", handlers.onNext);
  document.getElementById("zoomIn").addEventListener("click", handlers.onZoomIn);
  document.getElementById("zoomOut").addEventListener("click", handlers.onZoomOut);

  // Tools
  document.getElementById("toolHighlight")
    .addEventListener("click", () => handlers.onToolChange("highlight"));
  document.getElementById("toolNote")
    .addEventListener("click", () => handlers.onToolChange("note"));
}

export const ui = {
  pageNumEl:   () => document.getElementById("pageNum"),
  pageCountEl: () => document.getElementById("pageCount"),
  zoomLevelEl: () => document.getElementById("zoomLevel"),
};

export function setToolbarEnabled(enabled) {
  ["prevPage","nextPage","zoomIn","zoomOut","toolHighlight","toolNote"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });
}

export function setActiveToolButton(tool) {
  const ids = ["toolSelect","toolHighlight","toolNote"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isActive =
      (tool === null && id === "toolSelect") ||
      (tool === "highlight" && id === "toolHighlight") ||
      (tool === "note" && id === "toolNote");
    el.classList.toggle("active", isActive);
  });
}
