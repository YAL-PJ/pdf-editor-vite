/**
 * Toolbar state management and UI updates
 */

// UI element accessors
export const ui = {
  pageNumEl:   () => document.getElementById("pageNum"),
  pageCountEl: () => document.getElementById("pageCount"),
  zoomLevelEl: () => document.getElementById("zoomLevel"),
};

// Enable/disable all toolbar buttons
export function setToolbarEnabled(enabled) {
  const ids = ["prevPage","nextPage","zoomIn","zoomOut","toolSelect","toolHighlight","toolNote"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });
}

// Set active tool button visual state
export function setActiveToolButton(tool) {
  const mapping = [
    { id: "toolSelect",    val: null },
    { id: "toolHighlight", val: "highlight" },
    { id: "toolNote",      val: "note" },
  ];
  mapping.forEach(({ id, val }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("active", tool === val);
  });
}
