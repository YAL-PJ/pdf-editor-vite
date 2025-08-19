/**
 * pdfRenderer.js — render a PDF page to the canvas
 */
export async function renderPage(pdfDoc, pageNum = 1, scale = 1.0) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.getElementById("pdfCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;
  console.log(`Rendered page ${pageNum} @ ${Math.round(scale * 100)}%`);
}
