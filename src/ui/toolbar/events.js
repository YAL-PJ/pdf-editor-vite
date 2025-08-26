/**
 * Event handling for toolbar buttons
 */
export function attachToolbarEvents(handlers) {
  const safe = (fn) => (typeof fn === "function" ? fn : () => {});
  const log  = (msg) => console.log(`[toolbar] ${msg}`);

  // Navigation
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  if (prevBtn) prevBtn.addEventListener("click", () => { log("Prev page"); safe(handlers.onPrev)(); });
  if (nextBtn) nextBtn.addEventListener("click", () => { log("Next page"); safe(handlers.onNext)(); });

  // Zoom
  const zoomInBtn  = document.getElementById("zoomIn");
  const zoomOutBtn = document.getElementById("zoomOut");
  if (zoomInBtn)  zoomInBtn.addEventListener("click",  () => { log("Zoom in");  safe(handlers.onZoomIn)(); });
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => { log("Zoom out"); safe(handlers.onZoomOut)(); });

  // Tools
  const selectBtn    = document.getElementById("toolSelect");
  const highlightBtn = document.getElementById("toolHighlight");
  const noteBtn      = document.getElementById("toolNote");
  const textBtn      = document.getElementById("toolText");
  const imageBtn     = document.getElementById("toolImage");

  if (selectBtn)    selectBtn.addEventListener("click",    () => { log("Select tool");    safe(handlers.onToolChange)(null); });
  if (highlightBtn) highlightBtn.addEventListener("click", () => { log("Highlight tool"); safe(handlers.onToolChange)("highlight"); });
  if (noteBtn)      noteBtn.addEventListener("click",      () => { log("Note tool");      safe(handlers.onToolChange)("note"); });
  if (textBtn)      textBtn.addEventListener("click",      () => { log("Text tool");      safe(handlers.onToolChange)("text"); });
  if (imageBtn)     imageBtn.addEventListener("click",     () => { log("Image tool → open picker"); safe(handlers.onPickImage)(); });

  // Image file input
  const picker = document.getElementById("imagePicker");
  if (picker && handlers.onImageSelected) {
    picker.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) safe(handlers.onImageSelected)(file);
      e.target.value = ""; // allow re-picking the same file
    });
  }

  // Download (annotated)
  const dlBtn = document.getElementById("btnDownloadAnnotated");
  if (dlBtn) dlBtn.addEventListener("click", () => {
    log("Download annotated");
    // Expect the controller to provide this; it can call downloadAnnotatedPdf()
    safe(handlers.onDownloadAnnotated)();
  });
}