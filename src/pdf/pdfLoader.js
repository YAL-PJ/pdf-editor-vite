/**
 * pdfLoader.js
 * Purpose: Configure PDF.js and load a PDF document from a File object.
 * Why: Keeps all PDF.js specifics contained.
 */
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * loadPDF(file: File) -> Promise<{doc: pdfDoc, rawData: Uint8Array}>
 * Creates a blob URL for the selected file and asks PDF.js to load it.
 * It returns both the PDF.js document object and the raw file data.
 */
export async function loadPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const rawData = new Uint8Array(arrayBuffer); 

  const url = URL.createObjectURL(file);
  console.log("Loading PDF:", file.name);

  try {
    const doc = await pdfjsLib.getDocument(url).promise;
    return { doc, rawData };
  } finally {
    URL.revokeObjectURL(url);
  }
}