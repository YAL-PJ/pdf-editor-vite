/**
 * pdfRenderer.js
 * Purpose: Render a given page number at a given scale to the canvas.
 * Why: Isolates rendering math and canvas details.
 */
export async function renderPage(pdfDoc, pageNum = 1, scale = 1.0) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.getElementById("pdfCanvas");
  const ctx = canvas.getContext("2d");

  // Size canvas to match the PDF page at current scale
  canvas.width  = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  // Render the page into the canvas
  await page.render({ canvasContext: ctx, viewport }).promise;
  console.log(`Rendered page ${pageNum} @ ${Math.round(scale * 100)}%`);
}

