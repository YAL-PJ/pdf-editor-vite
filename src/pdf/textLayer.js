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

function spanFromRootOffset(layerRoot, offset) {
  if (!layerRoot) return null;
  const nodes = layerRoot.childNodes;
  const total = nodes.length;
  if (!total) return null;

  let index = Math.max(0, Math.min(offset, total - 1));
  if (offset >= total) {
    index = total - 1;
  }

  const pickCandidate = (start, step) => {
    let i = start;
    while (i >= 0 && i < total) {
      const candidate = nodes[i];
      if (candidate instanceof HTMLElement && candidate.dataset?.textSpan) {
        return candidate;
      }
      i += step;
    }
    return null;
  };

  let span = pickCandidate(index, -1);
  if (!span) {
    span = pickCandidate(index + 1, 1);
  }
  return span;
}

function resolveSpan(node, layerRoot, offset) {
  if (!node) return null;
  const container = layerRoot?.parentElement || null;
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
  if ((node === layerRoot || node === container) && typeof offset === "number") {
    const span = spanFromRootOffset(layerRoot, offset);
    if (span) return span;
  }
  return null;
}

function buildAnchor(layerRoot, node, offset) {
  if (!layerRoot || !node) return null;

  let span = resolveSpan(node, layerRoot, offset);
  if (!span && node instanceof Element && typeof offset === "number") {
    const children = node.childNodes;
    const target = children[offset] || children[offset - 1] || null;
    if (target) {
      span = resolveSpan(target, layerRoot);
    }
  }
  if (!span && typeof offset === "number") {
    span = spanFromRootOffset(layerRoot, offset);
  }
  if (!span) return null;
  const anchorElement = span || layerRoot;
  const start = span
    ? Number(span.dataset.charStart || "0")
    : 0;
  const end = span
    ? Number(span.dataset.charEnd || String(start))
    : Number(layerRoot.dataset?.charLength || "0");
  const length = Math.max(0, end - start);

  const preceding = sumPrecedingText(node, anchorElement);
  const base = initialOffsetForNode(node, offset) + preceding;
  const localOffset = clamp(base, 0, length);
  const charOffset = start + localOffset;

  if (!Number.isFinite(charOffset)) {
    return null;
  }

  return {
    spanId: span?.dataset?.textSpan || null,
    charStart: start,
    charEnd: end,
    charOffset,
    localOffset,
  };
}

export function getCharOffsetFromPoint(x, y) {
  const container = getContainer();
  const root = getLayerRoot();
  if (!container || !root) return null;

  const overlay = document.getElementById("annoLayer");
  const previousOverlayPointerEvents = overlay?.style.pointerEvents;
  if (overlay) overlay.style.pointerEvents = "none";
  const previousPointerEvents = container.style.pointerEvents;
  container.style.pointerEvents = "none";

  let range = null;
  if (typeof document.caretRangeFromPoint === "function") {
    range = document.caretRangeFromPoint(x, y);
  } else if (typeof document.caretPositionFromPoint === "function") {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos?.offsetNode != null) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }

  if (overlay) overlay.style.pointerEvents = previousOverlayPointerEvents || "";
  container.style.pointerEvents = previousPointerEvents || "";

  if (!range) return null;
  logSelectEvent("caret-range", {
    node: range.startContainer?.nodeName || null,
    offset: range.startOffset ?? null,
  });
  const anchor = buildAnchor(root, range.startContainer, range.startOffset);
  if (!anchor) {
    logSelectEvent("anchor-span-null", {
      node: range.startContainer?.nodeName || null,
      offset: range.startOffset ?? null,
    });
    return null;
  }
  logSelectEvent("anchor-resolved", {
    spanId: anchor.spanId,
    offset: anchor.charOffset,
  });
  return anchor.charOffset;
}

function logSelectEvent(event, detail) {
  try {
    window.__logSelectEvent?.(event, detail);
  } catch {}
}

export function createRangeFromOffsets(root, start, end) {
  if (!root || start == null || end == null) return null;
  const normalizedStart = Math.max(0, Math.min(start, end));
  const normalizedEnd = Math.max(start, end);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  let offset = 0;
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;

  while (current) {
    const text = current.textContent || "";
    const length = text.length;
    if (!startNode && offset + length >= normalizedStart) {
      startNode = current;
      startOffset = Math.max(0, normalizedStart - offset);
    }
    if (offset + length >= normalizedEnd) {
      endNode = current;
      endOffset = Math.max(0, normalizedEnd - offset);
      break;
    }
    offset += length;
    current = walker.nextNode();
  }

  if (!startNode) return null;
  if (!endNode) {
    endNode = startNode;
    endOffset = startNode.textContent?.length || 0;
  }
  const range = document.createRange();
  range.setStart(startNode, Math.min(startOffset, startNode.textContent.length));
  range.setEnd(endNode, Math.min(endOffset, endNode.textContent.length));
  return range;
}

export function createRangeForOffsets(start, end) {
  const root = getLayerRoot();
  if (!root) return null;
  return createRangeFromOffsets(root, start, end);
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

  const textViewport = typeof viewport.clone === "function"
    ? viewport.clone({ dontFlip: true })
    : viewport;

  let entry = builderCache.get(pageNum);
  if (!entry) {
    entry = { builder: null, layer: null, textContent: null };
    builderCache.set(pageNum, entry);
  } else {
    cancelBuilder(entry);
  }

  const textContent = await page.getTextContent({
    includeMarkedContent: true,
    disableNormalization: false,
  });

  if (renderToken !== token) {
    return { layer: entry.layer, textContent: entry.textContent || buildTextSnapshot(textContent) };
  }

  const builder = new TextLayerBuilder({
    pdfPage: page,
    // Ignore restrictive document permissions for local editing/selection.
    // Some PDFs disallow copying; enabling permissions would block selection.
    enablePermissions: false,
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
      viewport: textViewport,
      textContentParams: {
        includeMarkedContent: true,
        disableNormalization: false,
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
    const cssWidth = Math.max(0, Math.round(textViewport.width));
    const cssHeight = Math.max(0, Math.round(textViewport.height));
    layerDiv.style.width = `${cssWidth}px`;
    layerDiv.style.height = `${cssHeight}px`;
    layerDiv.style.setProperty("--scale-factor", String(textViewport.scale));
    layerDiv.style.setProperty("--user-unit", String(textViewport.userUnit || 1));
    layerDiv.style.setProperty("--total-scale-factor", String(textViewport.scale * (textViewport.userUnit || 1)));
    layerDiv.style.setProperty("--scale-round-x", "0px");
    layerDiv.style.setProperty("--scale-round-y", "0px");

    entry.meta = annotateTextLayer(layerDiv, pageNum);
    entry.layer = layerDiv;
    try {
      const canvas = document.getElementById("pdfCanvas");
      const canvasRect = canvas?.getBoundingClientRect?.();
      const layerRect = layerDiv.getBoundingClientRect?.();
      const scrollLeft = window.scrollX || window.pageXOffset || 0;
      const scrollTop = window.scrollY || window.pageYOffset || 0;
      let sampleRect = null;
      const sampleSpan = layerDiv.querySelector("span");
      if (sampleSpan instanceof HTMLElement) {
        const rect = sampleSpan.getBoundingClientRect?.();
        if (rect) {
          sampleRect = {
            x: rect.left + scrollLeft,
            y: rect.top + scrollTop,
            w: rect.width,
            h: rect.height,
          };
        }
      }
      const payload = {
        page: pageNum,
        canvas: canvasRect
          ? { x: canvasRect.left + scrollLeft, y: canvasRect.top + scrollTop, w: canvasRect.width, h: canvasRect.height }
          : null,
        layer: layerRect
          ? { x: layerRect.left + scrollLeft, y: layerRect.top + scrollTop, w: layerRect.width, h: layerRect.height }
          : null,
        sample: sampleRect,
        transform: layerDiv.style.transform || null,
      };
      logSelectEvent("text-layer-metrics", payload);
    } catch {}
  }

  const snapshot = buildTextSnapshot(textContent);
  const domText = layerDiv?.textContent;
  if (typeof domText === "string") {
    snapshot.text = domText;
  }
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
