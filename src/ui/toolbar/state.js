/**
 * Toolbar state management and UI updates
 */


// --- Single source of truth ---
const BUTTON_IDS = [
  "prevPage", "nextPage",
  "pageNum",
  "zoomIn", "zoomOut",
  "zoomLevel",
  "toolSelect", "toolHighlight", "toolTextHighlight", "toolNote",
  "toolText", "toolImage",
  "searchPrev", "searchNext", "searchClear", "searchInput",
];

const TOOL_BUTTON_IDS = [
  "toolSelect",
  "toolHighlight",
  "toolTextHighlight",
  "toolNote",
  "toolText",
  "toolImage",
];

// Map: tool value -> button id (null means the Select/regular cursor tool)
const TOOL_TO_ID = new Map([
  [null,          "toolSelect"],
  ["highlight",   "toolHighlight"],
  ["text-highlight", "toolTextHighlight"],
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
  // clear tool buttons only
  for (const id of TOOL_BUTTON_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.classList.remove("active");
    el.setAttribute("aria-pressed", "false");
  }
  // set active
  const activeId = TOOL_TO_ID.get(tool);
  if (!activeId) return; // e.g., null = Select (still has a button)
  const el = document.getElementById(activeId);
  if (el) {
    el.classList.add("active");
    el.setAttribute("aria-pressed", "true");
  }
}


