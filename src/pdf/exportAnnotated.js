// pdf/exportAnnotated.js
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
// The raw data is now passed as an argument, so no import is needed.
import { state } from "../app/state.js";

/**
 * downloadAnnotatedPdf(rawData: Uint8Array, filename: string)
 * Loads a PDF from raw data and adds annotations from state before downloading.
 */
export async function downloadAnnotatedPdf(rawData, filename = "annotated.pdf") {
  if (!rawData) {
    console.warn("[exportAnnotated] No PDF loaded, cannot export.");
    alert("Please load a PDF first before exporting.");
    return;
  }

  console.log("[exportAnnotated] Starting export with annotations...");

  const pdfDoc = await PDFDocument.load(rawData);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  // 🔴 Debug sanity check
  pages[0].drawText("DEBUG TEST", {
    x: 50, y: 50, size: 14, font, color: rgb(1, 0, 0),
  });
  console.log("[exportAnnotated] Drew DEBUG TEST at (50,50) on page 1");

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const anns = state.annotations?.[pageNum] || [];
    if (!anns.length) continue;

    const page = pages[i];
    const pw = page.getWidth();
    const ph = page.getHeight();

    console.log(`[exportAnnotated] Page ${pageNum}, width=${pw}, height=${ph}, anns=${anns.length}`);

    for (const ann of anns) {
      console.log("[exportAnnotated] Annotation object:", ann);

      if (ann.type === "highlight") {
        const [nx, ny, nw, nh] = ann.rect;
        const x = nx * pw;
        const yTopLeft = ny * ph;
        const h = nh * ph;
        const y = ph - yTopLeft - h;
        const w = nw * pw;

        console.log(`[exportAnnotated] Highlight → x=${x}, y=${y}, w=${w}, h=${h}`);

        page.drawRectangle({
          x, y, width: w, height: h,
          color: rgb(1, 1, 0), opacity: 0.35,
        });

      } else if (ann.type === "note" || ann.type === "text") {
        const text = (ann.text && ann.text.trim()) ? ann.text : "Note";
        const fontSize = ann.fontSize || 12;

        let x = 50, y = 50; // defaults
        if (ann.rect) {
          // For text tool
          const [nx, ny, nw, nh] = ann.rect;
          x = nx * pw;
          const yTopLeft = ny * ph;
          const h = nh * ph;
          y = ph - yTopLeft - h;
        } else if (ann.pos) {
          // For sticky notes
          const [nx, ny] = ann.pos;
          x = nx * pw;
          const yCanvas = ny * ph;
          y = ph - yCanvas - fontSize;
        }

        console.log(`[exportAnnotated] Text/Note → "${text}" at (x=${x}, y=${y}) fontSize=${fontSize}`);

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  console.log("[exportAnnotated] Export complete, triggering download...");

  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}