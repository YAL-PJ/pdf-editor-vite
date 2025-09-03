/**
 * Main toolbar API - combines template + events + state helpers
 */
import { createToolbarHTML } from "./template.js";
import { attachToolbarEvents } from "./events.js";
export { ui, setToolbarEnabled, setActiveToolButton } from "./state.js";

/**
 * Renders the toolbar into the given container and binds event handlers.
 * You can pass custom handlers; any that are missing will safely no-op.
 */
export function createToolbar(containerId, handlers = {}) {
  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Toolbar container #${containerId} not found`);

  // 1) Inject HTML
  el.innerHTML = createToolbarHTML();

  // 2) Attach events
  attachToolbarEvents(handlers);
}
