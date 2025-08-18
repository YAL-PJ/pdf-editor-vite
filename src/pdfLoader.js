/**
 * pdfLoader.js
 * Purpose: wrap PDF.js to open a PDF file
 */
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

// Create a module worker from /public
const worker = new Worker("/pdf.worker.min.mjs", { type: "module" });

// Tell PDF.js to use this worker port
pdfjsLib.GlobalWorkerOptions.workerPort = worker;

// Load a PDF chosen by the user
export async function loadPDF(file) {
  const url = URL.createObjectURL(file);
  console.log("Loading PDF:", file.name);
  return await pdfjsLib.getDocument(url).promise;
}
