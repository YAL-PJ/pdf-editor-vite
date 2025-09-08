// Single source of truth for defaults used across prefs + runtime
export const DEFAULT_RENDER_PREFS = {
  snapToGuides: true,
  snapEdgePx: 8,
};

export const DEFAULT_RENDER_CONFIG = {
  gridPx: 16,
  minTextW: 60,
  minTextH: 32,
  ...DEFAULT_RENDER_PREFS, // includes snapToGuides + snapEdgePx
};
