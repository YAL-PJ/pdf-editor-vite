/**
 * uiHandlers.js
 * Purpose: Handle user-facing input elements (file chooser, later: toggles).
 * Why: Decouples DOM inputs from app logic.
 */
export function setupFileInput(onFileSelected) {
  const input = document.getElementById("fileInput");
  const viewer = document.getElementById("viewer");
  const filePanel = document.querySelector(".file-input-panel");
  const trigger = document.getElementById("filePickerTrigger");
  const fileTriggerLabel = document.querySelector(".file-trigger-label"); // Added this line

  if (!input) {
    console.error("fileInput element not found in index.html");
    return;
  }

  const resetInput = () => {
    try {
      input.value = "";
    } catch (error) {
      console.warn("Unable to reset file input", error);
    }
  };

  const isPdfFile = (file) => {
    if (!file) return false;
    if (file.type === "application/pdf") return true;
    return file.name?.toLowerCase().endsWith(".pdf");
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!isPdfFile(file)) {
      console.warn("Ignored non-PDF file:", file.name ?? "unknown");
      return;
    }

    try {
      await onFileSelected(file);
    } finally {
      resetInput();
    }
  };

  const openPicker = () => {
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    } catch (err) { // Fixed: added missing catch block
      console.error("Failed to open file picker", err);
    }
  };

  if (fileTriggerLabel) {
    fileTriggerLabel.addEventListener("click", () => {
      console.log("[setupFileInput] trigger label click");
      openPicker(); // Added function call
    });

    fileTriggerLabel.addEventListener("keydown", (e) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      try {
        if (typeof input.showPicker === "function") {
          console.log("[setupFileInput] opening picker via showPicker");
          input.showPicker();
        } else {
          console.log("[setupFileInput] opening picker via click fallback");
          input.click();
        }
      } catch (err) {
        console.error("Failed to open file picker from keyboard", err);
      }
    });

    fileTriggerLabel.addEventListener("keyup", (e) => {
      if (e.key === " " || e.key === "Enter") {
        console.log("[setupFileInput] trigger label keyup", { key: e.key });
      }
    });
  }

  input.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  });
  
  trigger?.addEventListener("click", openPicker);

  if (!viewer) {
    return;
  }

  if (!viewer.hasAttribute("tabindex")) {
    viewer.setAttribute("tabindex", "0");
  }

  const setDragState = (active) => {
    viewer.classList.toggle("is-dragover", Boolean(active));
  };

  const isReadyForDrop = () => viewer.classList.contains("placeholder");

  const handleDragOver = (event) => {
    if (!isReadyForDrop()) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setDragState(true);
  };

  const handleDragLeave = (event) => {
    if (!isReadyForDrop()) return;
    const related = event.relatedTarget;
    if (
      related &&
      (viewer.contains(related) || (filePanel && filePanel.contains(related)))
    ) {
      return;
    }
    setDragState(false);
  };

  // Fixed: Defined the missing handleDrop function
  const handleDrop = async (e) => {
    console.log("[setupFileInput] drop on viewer", {
      ready: isReadyForDrop(),
      fileCount: e.dataTransfer?.files?.length ?? 0,
    });
    if (!isReadyForDrop()) return;
    e.preventDefault();
    setDragState(false);

    const file = e.dataTransfer?.files?.[0]; // Fixed: changed from 'event' to 'e'
    if (file) {
      void handleFile(file);
    }
  };

  // Removed duplicate event listeners - keeping only one set
  ["dragenter", "dragover"].forEach((type) =>
    viewer.addEventListener(type, handleDragOver)
  );
  ["dragleave", "dragend"].forEach((type) =>
    viewer.addEventListener(type, handleDragLeave)
  );
  viewer.addEventListener("drop", handleDrop);

  let lastPointerActivation = 0;

  const handlePlaceholderActivate = (event) => {
    if (!isReadyForDrop()) return;

    if (event.type === "keydown") {
      const key = event.key;
      if (key !== "Enter" && key !== " ") return;
      event.preventDefault();
      openPicker();
      return;
    }

    const isPointerEvent = event.type === "pointerdown" || event.type === "click";
    if (!isPointerEvent) return;

    const primaryButton = event.button === 0 || event.button === undefined;
    if (!primaryButton) return;

    // Avoid double-triggering when pointerdown already handled.
    if (event.type === "click" && lastPointerActivation) {
      const elapsed = performance.now() - lastPointerActivation;
      if (elapsed < 350) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.type === "pointerdown") {
      lastPointerActivation = performance.now();
    }

    openPicker();
  };

  const activationTargets = [
    viewer,
    document.getElementById("pdfCanvas"),
    document.getElementById("annoLayer"),
  ].filter(Boolean);

  activationTargets.forEach((el) => {
    el.addEventListener("pointerdown", handlePlaceholderActivate, true);
    el.addEventListener("click", handlePlaceholderActivate, true);
  });

  viewer.addEventListener("keydown", handlePlaceholderActivate, true);

  if (filePanel) {
    ["dragenter", "dragover"].forEach((type) =>
      filePanel.addEventListener(type, handleDragOver)
    );
    ["dragleave", "dragend"].forEach((type) =>
      filePanel.addEventListener(type, handleDragLeave)
    );
    filePanel.addEventListener("drop", handleDrop);
  }

  const blockWindowDrop = (event) => {
    if (!isReadyForDrop()) return;
    event.preventDefault();
  };

  window.addEventListener("dragover", blockWindowDrop);
  window.addEventListener("drop", blockWindowDrop);
}
