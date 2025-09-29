/**
 * Main toolbar API - combines template + events + state helpers
 */
import {
  createToolbarHTML,
  createNavControlsHTML,
  createHistoryControlsHTML,
  createSidebarSearchHTML,
} from "./template.js";
import { attachToolbarEvents } from "./events.js";
export { ui, setToolbarEnabled, setActiveToolButton } from "./state.js";

/**
 * Renders the toolbar into the given container and binds event handlers.
 * You can pass custom handlers; any that are missing will safely no-op.
 */
export function createToolbar(containerId, handlers = {}) {
  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Toolbar container #${containerId} not found`);

  // 1) Inject HTML for annotation tools
  el.innerHTML = createToolbarHTML();

  // 2) Render navigation and history controls in their dedicated hosts
  const navHost = document.getElementById("navControls");
  if (navHost) {
    navHost.innerHTML = createNavControlsHTML();
  } else {
    console.warn("[toolbar] #navControls not found; navigation controls not rendered");
  }

  const historyHost = document.getElementById("historyControls");
  if (historyHost) {
    historyHost.innerHTML = createHistoryControlsHTML();
  } else {
    console.warn("[toolbar] #historyControls not found; history controls not rendered");
  }

  const sidebarSearchHost = document.getElementById("sidebarSearch");
  if (sidebarSearchHost) {
    sidebarSearchHost.innerHTML = createSidebarSearchHTML();
  } else {
    console.warn("[toolbar] #sidebarSearch not found; search panel not rendered");
  }

  // 3) Attach events
  attachToolbarEvents(handlers);
}
