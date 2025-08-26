/**
 * persistence.js
 * Purpose: Handle saving and loading application state to/from localStorage.
 * Why: Separates persistence logic from the core controller.
 */
import { state } from "./state";

const STATE_KEY = "pdfEditorState";

/**
 * Save relevant state to localStorage.
 */
export function saveState() {
  try {
    // Only save what's needed for a refresh: loaded PDF data and annotations
    const stateToSave = {
      loadedPdfData: state.loadedPdfData,
      annotations: state.annotations,
    };
    
    // We need to convert the Uint8Array to a regular array for JSON.stringify
    stateToSave.loadedPdfData = state.loadedPdfData ? Array.from(state.loadedPdfData) : null;
    
    const serializedState = JSON.stringify(stateToSave);
    localStorage.setItem(STATE_KEY, serializedState);
    console.log("State saved to localStorage.");
  } catch (e) {
    console.error("Failed to save state to localStorage", e);
  }
}

/**
 * Load state from localStorage at app startup.
 * @returns {boolean} - true if state was loaded, false otherwise.
 */
export function loadState() {
  try {
    const serializedState = localStorage.getItem(STATE_KEY);
    if (serializedState === null) {
      return false; // No saved state found
    }

    const savedState = JSON.parse(serializedState);

    // If there is data, convert it back to a Uint8Array
    if (savedState.loadedPdfData) {
      state.loadedPdfData = new Uint8Array(savedState.loadedPdfData);
    }
    
    // Restore annotations
    state.annotations = savedState.annotations;

    console.log("State restored from localStorage.");
    return true;
  } catch (e) {
    console.error("Failed to load state from localStorage", e);
    return false;
  }
}