/**
 * uiHandlers.js
 * Purpose: handle user input (file chooser)
 */
export function setupFileInput(callback) {
  const input = document.getElementById("fileInput");
  if (!input) {
    console.error("fileInput element not found in index.html");
    return;
  }
  input.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      console.log("User selected file:", file.name);
      callback(file);
    }
  });
}
