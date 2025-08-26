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
  const textBtn      = document.getElementById("toolText");
  const imageBtn     = document.getElementById("toolImage");


  if (selectBtn)   selectBtn.addEventListener("click", () => safe(handlers.onToolChange)(null));
  if (highlightBtn)highlightBtn.addEventListener("click", () => safe(handlers.onToolChange)("highlight"));
  if (noteBtn)     noteBtn.addEventListener("click", () => safe(handlers.onToolChange)("note"));
  if (textBtn)      textBtn.addEventListener("click", () => safe(handlers.onToolChange)("text"));
  if (imageBtn)     imageBtn.addEventListener("click", () => safe(handlers.onPickImage)());
  

  if (textBtn)      textBtn.addEventListener("click", () => { console.log("[toolbar] Text tool clicked"); safe(handlers.onToolChange)("text"); });
  if (selectBtn)    selectBtn.addEventListener("click", () => { console.log("[toolbar] Select tool clicked"); safe(handlers.onToolChange)(null); });
  if (highlightBtn) highlightBtn.addEventListener("click", () => { console.log("[toolbar] Highlight tool clicked"); safe(handlers.onToolChange)("highlight"); });
  if (noteBtn)      noteBtn.addEventListener("click", () => { console.log("[toolbar] Note tool clicked"); safe(handlers.onToolChange)("note"); });
  if (imageBtn)     imageBtn.addEventListener("click", () => { console.log("[toolbar] Image tool clicked → open picker"); safe(handlers.onPickImage)(); });


  // wire image file input (handler provided by controller later)
  const picker = document.getElementById("imagePicker");
  if (picker && handlers.onImageSelected) {
    picker.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) safe(handlers.onImageSelected)(file);
      e.target.value = ""; // allow picking the same file again
    });
  }

}
