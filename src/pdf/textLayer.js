import { TextLayerBuilder } from "pdfjs-dist/web/pdf_viewer";

let renderToken = 0;
const builderCache = new Map();

function getContainer() {
  return document.getElementById("textLayer");
}

function cancelBuilder(entry) {
  if (!entry?.builder) return;
  try {
    entry.builder.cancel();
  } catch {
    // ignore cancellation errors
  }
}

export function setTextLayerInteractive(enabled) {
  const container = getContainer();
  if (!container) return;
  const isInteractive = !!enabled;
  container.classList.toggle("pdf-text-layer--interactive", isInteractive);
  if (isInteractive) {
    container.removeAttribute("aria-hidden");
  } else if (!container.hasAttribute("aria-hidden")) {
    container.setAttribute("aria-hidden", "true");
  }
}

export function clearTextLayer() {
  const container = getContainer();
  renderToken += 1;
  for (const entry of builderCache.values()) {
    cancelBuilder(entry);
  }
  builderCache.clear();
  if (container) {
    container.replaceChildren();
    container.classList.remove("pdf-text-layer--interactive");
    container.setAttribute("aria-hidden", "true");
  }
}

export async function renderTextLayer({ page, pageNum, viewport }) {
  const container = getContainer();
  if (!container || !page || !viewport) return null;

  renderToken += 1;
  const token = renderToken;

  const width = Math.max(0, Math.round(viewport.width));
  const height = Math.max(0, Math.round(viewport.height));
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;

  let entry = builderCache.get(pageNum);
  if (!entry) {
    entry = { builder: null, layer: null };
    builderCache.set(pageNum, entry);
  } else {
    cancelBuilder(entry);
  }

  const builder = new TextLayerBuilder({
    pdfPage: page,
    enablePermissions: true,
    onAppend: (div) => {
      if (renderToken !== token) return;
      div.setAttribute("role", "presentation");
      div.dataset.page = String(pageNum);
      entry.layer = div;
      container.replaceChildren(div);
    },
  });

  entry.builder = builder;

  try {
    await builder.render({
      viewport,
      textContentParams: {
        includeMarkedContent: true,
        disableNormalization: true,
      },
    });
  } catch (err) {
    if (renderToken !== token || err?.name === "RenderingCancelledException") {
      return entry.layer || null;
    }
    throw err;
  }

  if (renderToken !== token) {
    return entry.layer || null;
  }

  return entry.layer || container.firstElementChild;
}


