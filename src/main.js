/**
 * main.js — orchestrates UI → load → render
 */
import { setupFileInput } from "./uiHandlers";
import { loadPDF } from "./pdfLoader";
import { renderPage } from "./pdfRenderer";

setupFileInput(async (file) => {
  const pdfDoc = await loadPDF(file);
  await renderPage(pdfDoc, 1);
});
