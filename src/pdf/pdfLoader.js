/**
 * pdfLoader.js
 * Purpose: Configure PDF.js and load a PDF document from a File object.
 * Why: Keeps all PDF.js specifics contained.
 */
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

let loadedPdfData = null;
export { loadedPdfData };


// Use a module worker we placed in /public (modern + Vite-friendly)
const worker = new Worker("/pdf.worker.min.mjs", { type: "module" });
pdfjsLib.GlobalWorkerOptions.workerPort = worker;

/**
 * loadPDF(file: File) -> Promise<pdfDoc>
 * Creates a blob URL for the selected file and asks PDF.js to load it.
 */
export async function loadPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  loadedPdfData = new Uint8Array(arrayBuffer);   // <-- store raw data

  const url = URL.createObjectURL(file);
  console.log("Loading PDF:", file.name);
  return await pdfjsLib.getDocument(url).promise;
}

