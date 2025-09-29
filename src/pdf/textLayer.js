import { TextLayerBuilder } from "pdfjs-dist/web/pdf_viewer";

/** @typedef {{
 *  builder: TextLayerBuilder | null,
 *  layer: HTMLElement | null,
 *  textContent: { items: any[], text: string } | null,
 *  meta?: { spanMeta: Array<{ id: string, start: number, end: number, length: number }>, charLength: number }
 * }} TextLayerEntry
 */

let renderToken = 0;
/** @type {Map<number, TextLayerEntry>} */
const builderCache = new Map();

const TEXT_SPAN_PREFIX = "p";

function getContainer() {
  return document.getElementById("textLayer");
}

function getLayerRoot() {
  return getContainer()?.firstElementChild || null;
}

function cancelBuilder(entry) {
  if (!entry?.builder) return;
  try {
    entry.builder.cancel();
  } catch {
    // ignore cancellation errors
  }
}

function buildTextSnapshot(textContent) {
  const items = Array.isArray(textContent?.items) ? textContent.items : [];
  let text = "";
  for (const item of items) {
    if (!item) continue;
    const chunk = typeof item.str === "string" ? item.str : "";
    text += chunk;
    if (item.hasEOL) text += "\n";
  }
  return { items, text };
}

function annotateTextLayer(layerDiv, pageNum) {
  const spans = Array.from(layerDiv.querySelectorAll("span"));
  let charOffset = 0;
  let ordinal = 0;
  const spanMeta = [];

  for (const span of spans) {
    if (!(span instanceof HTMLElement)) continue;
    const length = span.textContent?.length || 0;
    const spanId = `${TEXT_SPAN_PREFIX}${pageNum}-s${ordinal}`;
    span.dataset.page = String(pageNum);
    span.dataset.textSpan = spanId;
    span.dataset.textIndex = String(ordinal);
    span.dataset.charStart = String(charOffset);
    span.dataset.charEnd = String(charOffset + length);
    spanMeta.push({ id: spanId, start: charOffset, end: charOffset + length, length });
    charOffset += length;
    ordinal += 1;
  }

  layerDiv.dataset.page = String(pageNum);
  layerDiv.dataset.charLength = String(charOffset);
  return { spanMeta, charLength: charOffset };
}

function nodeTextLength(node) {
  if (!node) return 0;
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.length || 0;
  }
  let total = 0;
  for (const child of node.childNodes) {
    total += nodeTextLength(child);
  }
  return total;
}

function initialOffsetForNode(node, offset) {
  if (!node) return 0;
  if (node.nodeType === Node.TEXT_NODE) {
    const length = node.textContent?.length || 0;
    const clamped = Math.min(Math.max(offset, 0), length);
    return clamped;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = /** @type {Element} */ (node);
    const total = element.childNodes.length;
    const limit = Math.min(Math.max(offset, 0), total);
    let sum = 0;
    for (let i = 0; i < limit; i += 1) {
      sum += nodeTextLength(element.childNodes[i]);
    }
    return sum;
  }
  return 0;
}

function sumPrecedingText(node, stop) {
  let total = 0;
  let current = node;
  while (current && current !== stop) {
    let sibling = current.previousSibling;
    while (sibling) {
      total += nodeTextLength(sibling);
      sibling = sibling.previousSibling;
    }
    current = current.parentNode;
  }
  return total;
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function resolveSpan(node, layerRoot) {
  if (!node) return null;
  let current = node;
  if (current.nodeType === Node.TEXT_NODE) {
    current = current.parentElement;
  }
  while (current && current !== layerRoot) {
    if (current instanceof HTMLElement && current.dataset?.textSpan) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function buildAnchor(layerRoot, node, offset) {
  const span = resolveSpan(node, layerRoot);
  if (!span) return null;
  const start = Number(span.dataset.charStart || "0");
  const end = Number(span.dataset.charEnd || String(start));
  const length = Math.max(0, end - start);

  const base = initialOffsetForNode(node, offset) + sumPrecedingText(node, span);
  const localOffset = clamp(base, 0, length);
  const charOffset = start + localOffset;

  return {
    spanId: span.dataset.textSpan || null,
    charStart: start,
    charEnd: end,
    charOffset,
    localOffset,
  };
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
  if (!container || !page || !viewport) {
    return { layer: null, textContent: null };
  }

  renderToken += 1;
  const token = renderToken;

  const width = Math.max(0, Math.round(viewport.width));
  const height = Math.max(0, Math.round(viewport.height));
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;

  let entry = builderCache.get(pageNum);
  if (!entry) {
    entry = { builder: null, layer: null, textContent: null };
    builderCache.set(pageNum, entry);
  } else {
    cancelBuilder(entry);
  }

  const textContent = await page.getTextContent({
    includeMarkedContent: true,
    disableNormalization: true,
  });

  if (renderToken !== token) {
    return { layer: entry.layer, textContent: entry.textContent || buildTextSnapshot(textContent) };
  }

  const builder = new TextLayerBuilder({
    pdfPage: page,
    enablePermissions: true,
    onAppend: (div) => {
      if (renderToken !== token) return;
      div.setAttribute("role", "presentation");
      div.dataset.page = String(pageNum);
      container.replaceChildren(div);
      entry.layer = div;
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
      return { layer: entry.layer, textContent: entry.textContent || buildTextSnapshot(textContent) };
    }
    console.error("[textLayer] render failed", err);
    throw err;
  }

  if (renderToken !== token) {
    return { layer: entry.layer, textContent: entry.textContent || buildTextSnapshot(textContent) };
  }

  const layerDiv = entry.layer || container.firstElementChild;
  if (layerDiv instanceof HTMLElement) {
    entry.meta = annotateTextLayer(layerDiv, pageNum);
    entry.layer = layerDiv;
  }

  const snapshot = buildTextSnapshot(textContent);
  entry.textContent = snapshot;

  return { layer: entry.layer, textContent: snapshot };
}

export function describeRangeAnchors(range) {
  if (!range) return null;
  const container = getContainer();
  const root = getLayerRoot();
  if (!container || !root) return null;
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null;
  }

  const start = buildAnchor(root, range.startContainer, range.startOffset);
  const end = buildAnchor(root, range.endContainer, range.endOffset);
  if (!start || !end) return null;

  const page = Number(root.dataset.page || "0") || null;
  return { page, start, end };
}

export function getCachedTextContent(pageNum) {
  return builderCache.get(pageNum)?.textContent || null;
}
