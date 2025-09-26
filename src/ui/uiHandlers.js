/**
 * uiHandlers.js
 * Purpose: Handle user-facing input elements (file chooser, later: toggles).
 * Why: Decouples DOM inputs from app logic.
 */
export function setupFileInput(onFileSelected) {
  const input = document.getElementById("fileInput");
  const viewer = document.getElementById("viewer");
  const filePanel = document.querySelector(".file-input-panel");

  const resetInput = () => {
    if (!input) return;
    try { input.value = ""; } catch {}
  };

  const isPdfFile = (file) => {
    if (!file) return false;
    if (file.type === "application/pdf") return true;
    return file.name?.toLowerCase().endsWith(".pdf");
  };

  const processFile = async (file) => {
    if (!file || !isPdfFile(file)) {
      if (file) console.warn("Ignored non-PDF file drop:", file.name);
      return;
    }
    console.log("User selected file:", file.name);
    await onFileSelected(file);
  };

  if (!input) {
    console.error("fileInput element not found in index.html");
  } else {
    input.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        await processFile(file);
      } finally {
        resetInput();
      }
    });
  }

  if (!viewer) return;

  const setDragState = (active) => {
    viewer.classList.toggle("is-dragover", !!active);
  };

  const isReadyForDrop = () => viewer.classList.contains("placeholder");

  const handleDragOver = (e) => {
    if (!isReadyForDrop()) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    setDragState(true);
  };

  const handleDragLeave = (e) => {
    if (!isReadyForDrop()) return;
    if (
      e.relatedTarget &&
      (viewer.contains(e.relatedTarget) || filePanel?.contains(e.relatedTarget))
    ) {
      return;
    }
    setDragState(false);
  };

  ["dragenter", "dragover"].forEach((evt) => viewer.addEventListener(evt, handleDragOver));
  ["dragleave", "dragend"].forEach((evt) => viewer.addEventListener(evt, handleDragLeave));
  viewer.addEventListener("drop", async (e) => {
    if (!isReadyForDrop()) return;
    e.preventDefault();
    setDragState(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    await processFile(file);
    resetInput();
  });

  if (filePanel) {
    ["dragenter", "dragover"].forEach((evt) => filePanel.addEventListener(evt, handleDragOver));
    ["dragleave", "dragend"].forEach((evt) => filePanel.addEventListener(evt, handleDragLeave));
    filePanel.addEventListener("drop", async (e) => {
      if (!isReadyForDrop()) return;
      e.preventDefault();
      setDragState(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      await processFile(file);
      resetInput();
    });
  }

  const blockWindowDrop = (e) => {
    if (!isReadyForDrop()) return;
    e.preventDefault();
  };

  window.addEventListener("dragover", blockWindowDrop);
  window.addEventListener("drop", blockWindowDrop);
}
