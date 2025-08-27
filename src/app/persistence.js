/**
 * persistence.js
 * Purpose: Handle saving and loading application state to/from sessionStorage.
 * Why: Separates persistence logic from the core controller.
 */
import { state } from "./state";

const STATE_KEY = "pdfEditorState";

// Track if the page is being refreshed
let isRefreshing = false;

/**
 * Save relevant state to sessionStorage.
 */
export function saveState() {
    try {
        const stateToSave = {
            loadedPdfData: state.loadedPdfData ? Array.from(state.loadedPdfData) : null,
            annotations: state.annotations,
        };
        const serializedState = JSON.stringify(stateToSave);
        sessionStorage.setItem(STATE_KEY, serializedState);
        console.log("State saved to sessionStorage.");
    } catch (e) {
        console.error("Failed to save state to sessionStorage", e);
    }
}

/**
 * Load state from sessionStorage at app startup.
 * @returns {boolean} - true if state was loaded, false otherwise.
 */
export function loadState() {
    try {
        const serializedState = sessionStorage.getItem(STATE_KEY);
        if (serializedState === null) {
            return false; // No saved state found
        }

        const savedState = JSON.parse(serializedState);

        if (savedState.loadedPdfData) {
            state.loadedPdfData = new Uint8Array(savedState.loadedPdfData);
        }

        state.annotations = savedState.annotations;

        console.log("State restored from sessionStorage.");
        return true;
    } catch (e) {
        console.error("Failed to load state from sessionStorage", e);
        return false;
    }
}

/**
 * Add a warning message before the user closes the tab.
 */
export function initUnloadWarning() {
    // Listen for refresh attempts (F5, Ctrl+R, etc.)
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'F5') || 
            (e.ctrlKey && e.key === 'r') || 
            (e.metaKey && e.key === 'r')) {
            isRefreshing = true;
        }
    });

    // Also catch browser refresh button clicks
    // This works by detecting if the page is being navigated to itself
    const currentUrl = window.location.href;
    
    // Save state before unload (for refresh scenarios)
    window.addEventListener('beforeunload', (e) => {
        // Always save state first
        if (state.loadedPdfData || Object.keys(state.annotations).length > 0) {
            saveState();
        }

        // Only show warning if:
        // 1. Not a refresh operation
        // 2. There's data to lose
        if (!isRefreshing && (state.loadedPdfData || Object.keys(state.annotations).length > 0)) {
            e.preventDefault();
            e.returnValue = ''; // Required for Chrome
            return ''; // Required for other browsers
        }
    });

    // Reset the refresh flag when the page actually loads
    // This handles cases where refresh was cancelled
    window.addEventListener('load', () => {
        isRefreshing = false;
    });

    // Additional safety: detect navigation within same origin
    window.addEventListener('pagehide', () => {
        // Save state when page is being hidden (covers more scenarios)
        if (state.loadedPdfData || Object.keys(state.annotations).length > 0) {
            saveState();
        }
    });
}