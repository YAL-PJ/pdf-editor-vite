/**
 * main.js — orchestrates UI → load → render
 */
import { setupFileInput } from "./uiHandlers";
import { loadPDF } from "./pdfLoader";
import { renderPage } from "./pdfRenderer";
import { createToolbar } from "./toolbar";

createToolbar("toolbar");

// --- App state ---
let pdfDoc = null;
let pageNum = 1;
let scale = 1.0;

// --- UI refs ---
const pageNumEl = () => document.getElementById("pageNum");
const pageCountEl = () => document.getElementById("pageCount");
const zoomLevelEl = () => document.getElementById("zoomLevel");

// Re-render helper
async function rerender() {
  if (!pdfDoc) return;
  await renderPage(pdfDoc, pageNum, scale);
  pageNumEl().textContent = String(pageNum);
  zoomLevelEl().textContent = `${Math.round(scale * 100)}%`;
}

// Load file -> get doc -> render page 1
setupFileInput(async (file) => {
  pdfDoc = await loadPDF(file);
  pageNum = 1;
  pageCountEl().textContent = String(pdfDoc.numPages);
  await rerender();
});

// --- Toolbar events ---
document.getElementById("prevPage").addEventListener("click", async () => {
  if (!pdfDoc || pageNum <= 1) return;
  pageNum -= 1;
  await rerender();
});

document.getElementById("nextPage").addEventListener("click", async () => {
  if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
  pageNum += 1;
  await rerender();
});

document.getElementById("zoomIn").addEventListener("click", async () => {
  if (!pdfDoc) return;
  scale = Math.min(scale + 0.1, 3); // cap at 300%
  await rerender();
});

document.getElementById("zoomOut").addEventListener("click", async () => {
  if (!pdfDoc) return;
  scale = Math.max(scale - 0.1, 0.3); // min 30%
  await rerender();
});
