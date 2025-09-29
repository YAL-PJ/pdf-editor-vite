// pdf/exportAnnotated.js
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { state } from "../app/state.js";

const PDF_MIME = "application/pdf";
const NO_PDF_MESSAGE = "Please load a PDF first before exporting.";
const NO_PDF_ERROR_CODE = "NO_PDF_DATA";

function createNoPdfError() {
  const error = new Error(NO_PDF_MESSAGE);
  error.code = NO_PDF_ERROR_CODE;
  return error;
}

/**
 * Convert an image src (data: URL or object URL) into bytes and a mime hint.
 */
async function srcToBytesAndType(src) {
  if (typeof src === "string" && src.startsWith("data:")) {
    const comma = src.indexOf(",");
    const header = src.slice(5, comma);
    const base64 = src.slice(comma + 1);
    const mime = header.split(";")[0];
    const binStr = atob(base64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
    return { bytes, mime };
  }

  const resp = await fetch(src);
  const mime = resp.headers.get("content-type") || "";
  const buf = await resp.arrayBuffer();
  return { bytes: new Uint8Array(buf), mime };
}

function isPngBytes(bytes, mimeHint) {
  if (mimeHint && mimeHint.toLowerCase().includes("png")) return true;
  if (bytes.length >= 8) {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return false;
    return true;
  }
  return false;
}

function ensurePdfInput(rawData) {
  if (!rawData) throw createNoPdfError();
  return rawData;
}

function triggerDownloadFromBlob(blob, filename = "annotated.pdf") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function handleExportError(err) {
  if (!err) return;
  if (err.code === NO_PDF_ERROR_CODE) {
    alert(NO_PDF_MESSAGE);
    return;
  }
  console.error("[exportAnnotated] Export failed", err);
  alert("Something went wrong while exporting. Please try again.");
}

async function printBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.setAttribute("aria-hidden", "true");

    const cleanup = () => {
      URL.revokeObjectURL(url);
      iframe.remove();
    };

    iframe.addEventListener("load", () => {
      try {
        const win = iframe.contentWindow;
        win?.focus?.();
        win?.print?.();
        setTimeout(() => {
          cleanup();
          resolve();
        }, 0);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });

    iframe.src = url;
    document.body.appendChild(iframe);
  });
}

async function generatePdfDocument(rawData) {
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
        const rects = Array.isArray(ann.rects) && ann.rects.length
          ? ann.rects
          : ann.rect
          ? [ann.rect]
          : [];

        for (const rect of rects) {
          if (!Array.isArray(rect) || rect.length !== 4) continue;
          const [nx, ny, nw, nh] = rect;
          const w = nw * pw;
          const h = nh * ph;
          const x = nx * pw;
          const y = ph - ny * ph - h;

          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgb(1, 1, 0),
            opacity: 0.35,
          });
        }
      } else if (ann.type === "note" || ann.type === "text") {
        const text = ann.text?.trim() ? ann.text : "Note";
        const fontSize = ann.fontSize || 12;

        let x = 50;
        let y = 50;
        if (ann.rect) {
          const [nx, ny, nw, nh] = ann.rect;
          const w = nw * pw;
          const h = nh * ph;
          x = nx * pw;
          y = ph - ny * ph - h;
        } else if (ann.pos) {
          const [nx, ny] = ann.pos;
          x = nx * pw;
          y = ph - ny * ph - fontSize;
        }

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      } else if (ann.type === "image" && ann.src) {
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
        } catch (error) {
          console.warn("[exportAnnotated] Failed to embed image", error);
        }
      }
    }
  }

  return pdfDoc;
}

export async function generateAnnotatedPdfBlob(rawData) {
  ensurePdfInput(rawData);
  const pdfDoc = await generatePdfDocument(rawData);
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: PDF_MIME });
}

export async function downloadAnnotatedPdf(rawData, filename = "annotated.pdf") {
  try {
    const blob = await generateAnnotatedPdfBlob(rawData);
    triggerDownloadFromBlob(blob, filename);
  } catch (err) {
    handleExportError(err);
  }
}

export async function printAnnotatedPdf(rawData) {
  let blob;
  try {
    blob = await generateAnnotatedPdfBlob(rawData);
  } catch (err) {
    handleExportError(err);
    return;
  }

  try {
    await printBlob(blob);
  } catch (err) {
    console.error("[exportAnnotated] Print failed; falling back to download.", err);
    triggerDownloadFromBlob(blob);
  }
}

export async function shareAnnotatedPdf(rawData, filename = "annotated.pdf") {
  let blob;
  try {
    blob = await generateAnnotatedPdfBlob(rawData);
  } catch (err) {
    handleExportError(err);
    return false;
  }

  const nav = typeof navigator !== "undefined" ? navigator : null;
  const hasFileCtor = typeof File === "function";

  if (nav?.share && hasFileCtor) {
    const file = new File([blob], filename, { type: PDF_MIME });
    const shareData = { files: [file], title: filename };
    const canShare = typeof nav.canShare === "function" ? nav.canShare(shareData) : true;
    if (canShare) {
      try {
        await nav.share(shareData);
        return true;
      } catch (err) {
        if (err?.name === "AbortError") {
          return false;
        }
        console.warn("[exportAnnotated] navigator.share failed; falling back to download.", err);
      }
    }
  }

  triggerDownloadFromBlob(blob, filename);
  return false;
}
