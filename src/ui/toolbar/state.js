/**
 * Toolbar state management and UI updates
 */


// --- Single source of truth ---
const BUTTON_IDS = [
  "prevPage", "nextPage",
  "zoomIn", "zoomOut",
  "toolSelect", "toolHighlight", "toolNote",
  "toolText", "toolImage",
];


// Map: tool value -> button id (null means the Select/regular cursor tool)
const TOOL_TO_ID = new Map([
  [null,          "toolSelect"],
  ["highlight",   "toolHighlight"],
  ["note",        "toolNote"],
  ["text",        "toolText"],
  ["image",       "toolImage"],
]);


// UI element accessors
export const ui = {
  pageNumEl:   () => document.getElementById("pageNum"),
  pageCountEl: () => document.getElementById("pageCount"),
  zoomLevelEl: () => document.getElementById("zoomLevel"),
};

// Enable/disable all toolbar buttons
export function setToolbarEnabled(enabled) {
  BUTTON_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });
}
// --- Active tool visual state ---
export function setActiveToolButton(tool) {
  // clear all
  for (const id of BUTTON_IDS) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  }
  // set the one matching the tool (if present)
  const activeId = TOOL_TO_ID.get(tool);
  if (!activeId) return; // null/undefined tool -> no active styling (or Select handled via map)
  const el = document.getElementById(activeId);
  if (el) el.classList.add("active");
}


