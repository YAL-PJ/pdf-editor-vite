/**
 * Event handling for toolbar buttons
 */
export function attachToolbarEvents(handlers) {
  // Defensive: skip if a handler is missing
  const safe = (fn) => (typeof fn === "function" ? fn : () => {});

  // Navigation
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  if (prevBtn) prevBtn.addEventListener("click", safe(handlers.onPrev));
  if (nextBtn) nextBtn.addEventListener("click", safe(handlers.onNext));

  // Zoom
  const zoomInBtn = document.getElementById("zoomIn");
  const zoomOutBtn = document.getElementById("zoomOut");
  if (zoomInBtn) zoomInBtn.addEventListener("click", safe(handlers.onZoomIn));
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", safe(handlers.onZoomOut));

  // Tools
  const selectBtn = document.getElementById("toolSelect");
  const highlightBtn = document.getElementById("toolHighlight");
  const noteBtn = document.getElementById("toolNote");
  if (selectBtn)   selectBtn.addEventListener("click", () => safe(handlers.onToolChange)(null));
  if (highlightBtn)highlightBtn.addEventListener("click", () => safe(handlers.onToolChange)("highlight"));
  if (noteBtn)     noteBtn.addEventListener("click", () => safe(handlers.onToolChange)("note"));
}
