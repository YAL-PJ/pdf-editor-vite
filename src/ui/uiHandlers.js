/**
 * uiHandlers.js
 * Purpose: Handle user-facing input elements (file chooser, later: toggles).
 * Why: Decouples DOM inputs from app logic.
 */
export function setupFileInput(onFileSelected) {
  const input = document.getElementById("fileInput");
  if (!input) {
    console.error("fileInput element not found in index.html");
    return;
  }
  input.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      console.log("User selected file:", file.name);
      onFileSelected(file);
    }
  });
}

