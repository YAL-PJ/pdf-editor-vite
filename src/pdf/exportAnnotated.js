// pdf/exportAnnotated.js
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { state } from "../app/state.js";

/**
 * Convert an image src (data: URL or object URL) into bytes and a mime hint.
 */
async function srcToBytesAndType(src) {
  // Data URL?
  if (typeof src === "string" && src.startsWith("data:")) {
    const comma = src.indexOf(",");
    const header = src.slice(5, comma); // e.g., "image/png;base64"
    const base64 = src.slice(comma + 1);
    const mime = header.split(";")[0]; // "image/png"
    const binStr = atob(base64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
    return { bytes, mime };
  }

  // Blob/object URL or remote URL
  const resp = await fetch(src);
  const mime = resp.headers.get("content-type") || "";
  const buf = await resp.arrayBuffer();
  return { bytes: new Uint8Array(buf), mime };
}

/**
 * Heuristic: decide PNG vs JPEG for pdf-lib embedders.
 */
function isPngBytes(bytes, mimeHint) {
  if (mimeHint && mimeHint.toLowerCase().includes("png")) return true;
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (bytes.length >= 8) {
    const sig = [0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A];
    for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return false;
    return true;
  }
  return false;
}

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

  const pdfDoc = await PDFDocument.load(rawData);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const anns = state.annotations?.[pageNum] || [];
    if (!anns.length) continue;

    const page = pages[i];
    const pw = page.getWidth();
    const ph = page.getHeight();

    for (const ann of anns) {
      if (ann.type === "highlight") {
        const [nx, ny, nw, nh] = ann.rect;
        const w = nw * pw;
        const h = nh * ph;
        const x = nx * pw;
        const y = ph - ny * ph - h; // convert from top-left to PDF bottom-left

        page.drawRectangle({
          x, y, width: w, height: h,
          color: rgb(1, 1, 0), opacity: 0.35,
        });

      } else if (ann.type === "note" || ann.type === "text") {
        const text = (ann.text && ann.text.trim()) ? ann.text : "Note";
        const fontSize = ann.fontSize || 12;

        let x = 50, y = 50; // defaults
        if (ann.rect) {
          // Text tool box (normalized rect)
          const [nx, ny, nw, nh] = ann.rect;
          const w = nw * pw;
          const h = nh * ph;
          x = nx * pw;
          y = ph - ny * ph - h;
        } else if (ann.pos) {
          // Sticky note (normalized point)
          const [nx, ny] = ann.pos;
          x = nx * pw;
          y = ph - ny * ph - fontSize;
        }

        page.drawText(text, {
          x, y, size: fontSize, font, color: rgb(0, 0, 0),
        });

      } else if (ann.type === "image" && ann.src) {
        // ---- IMAGE SUPPORT ----
        try {
          const { bytes, mime } = await srcToBytesAndType(ann.src);
          const embed = isPngBytes(bytes, mime)
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);

          const [nx, ny, nw, nh] = ann.rect;
          const w = nw * pw;
          const h = nh * ph;
          const x = nx * pw;
          const y = ph - ny * ph - h;

          page.drawImage(embed, { x, y, width: w, height: h });
        } catch (e) {
          console.warn("[exportAnnotated] Failed to embed image:", e);
        }
      }
    }
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
