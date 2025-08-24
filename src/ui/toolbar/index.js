/**
 * Main toolbar API - combines template + events + state helpers
 */
import { createToolbarHTML } from "./template.js";
import { attachToolbarEvents } from "./events.js";
export { ui, setToolbarEnabled, setActiveToolButton } from "./state.js";

export function createToolbar(containerId, handlers) {
  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Toolbar container #${containerId} not found`);

  // 1) inject HTML
  el.innerHTML = createToolbarHTML();

  // 2) attach events
  attachToolbarEvents(handlers);
}
