import { state } from "@app/state";

const searchState = {
  query: "",
  matches: [],
  index: -1,
  textCache: new Map(),
  highlightEls: [],
};

function getStatusEl() {
  return document.getElementById("searchStatus");
}

function clearHighlightEls() {
  const container = document.getElementById("textLayer");
  if (!container) {
    searchState.highlightEls = [];
    return;
  }
  for (const el of searchState.highlightEls) {
    if (el && el.parentElement === container) {
      el.remove();
    }
  }
  searchState.highlightEls = [];
}

function updateStatus() {
  const statusEl = getStatusEl();
  const total = searchState.matches.length;
  const current = searchState.index >= 0 ? searchState.index + 1 : 0;
  if (!statusEl) return;
  statusEl.textContent = `${current} / ${total}`;
  statusEl.dataset.empty = total === 0 ? "true" : "false";
}

function normalizeTextItems(items = []) {
  let out = "";
  for (const item of items) {
    out += item.str || "";
    if (item.hasEOL) out += "\n";
  }
  return out;
}

async function ensurePageText(pageNum) {
  if (searchState.textCache.has(pageNum)) {
    return searchState.textCache.get(pageNum);
  }
  if (!state.pdfDoc) return { text: "", lower: "" };
  const page = await state.pdfDoc.getPage(pageNum);
  const textContent = await page.getTextContent({ includeMarkedContent: true });
  const text = normalizeTextItems(textContent.items);
  const lower = text.toLowerCase();
  const cached = { text, lower };
  searchState.textCache.set(pageNum, cached);
  return cached;
}

function createRangeFromOffsets(root, start, end) {
  if (!root || start < 0 || end <= start) return null;
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
    if (!startNode && offset + length >= start) {
      startNode = current;
      startOffset = Math.max(0, start - offset);
    }
    if (startNode && offset + length >= end) {
      endNode = current;
      endOffset = Math.max(0, end - offset);
      break;
    }
    offset += length;
    current = walker.nextNode();
  }

  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, Math.min(startOffset, startNode.textContent.length));
  range.setEnd(endNode, Math.min(endOffset, endNode.textContent.length));
  return range;
}

function highlightMatch(match, textLayerDiv) {
  clearHighlightEls();
  const container = document.getElementById("textLayer");
  if (!container || !textLayerDiv || !match) return;
  const layerRect = container.getBoundingClientRect();
  const range = createRangeFromOffsets(textLayerDiv, match.start, match.end);
  if (!range) return;
  const rects = Array.from(range.getClientRects());
  if (!rects.length) return;
  const frag = document.createDocumentFragment();
  for (const rect of rects) {
    if (rect.width < 1 || rect.height < 1) continue;
    const el = document.createElement("div");
    el.className = "text-layer-search-hit";
    el.style.left = `${rect.left - layerRect.left}px`;
    el.style.top = `${rect.top - layerRect.top}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    frag.appendChild(el);
    searchState.highlightEls.push(el);
  }
  container.appendChild(frag);
}

export async function setSearchQuery(query) {
  const normalized = (query || "").trim();
  if (searchState.query === normalized) return searchState.matches.length;

  searchState.query = normalized;
  searchState.matches = [];
  searchState.index = -1;
  clearHighlightEls();
  updateStatus();

  if (!normalized || !state.pdfDoc) {
    return 0;
  }

  const needle = normalized.toLowerCase();
  const totalPages = state.pdfDoc.numPages || 0;
  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    const { text, lower } = await ensurePageText(pageNum);
    if (!lower) continue;
    let idx = lower.indexOf(needle);
    while (idx !== -1) {
      searchState.matches.push({ pageNum, start: idx, end: idx + normalized.length });
      idx = lower.indexOf(needle, idx + Math.max(1, needle.length));
    }
  }

  updateStatus();
  return searchState.matches.length;
}

export function clearSearch() {
  searchState.query = "";
  searchState.matches = [];
  searchState.index = -1;
  clearHighlightEls();
  updateStatus();
}

export function resetSearchState() {
  clearSearch();
  searchState.textCache.clear();
}

export function stepMatch(delta) {
  if (!Number.isInteger(delta)) return null;
  const total = searchState.matches.length;
  if (!total) {
    updateStatus();
    return null;
  }
  let nextIndex = searchState.index;
  if (nextIndex < 0) {
    nextIndex = delta > 0 ? 0 : total - 1;
  } else {
    nextIndex = (nextIndex + delta + total) % total;
  }
  searchState.index = nextIndex;
  updateStatus();
  return searchState.matches[nextIndex];
}

export function getCurrentMatch() {
  if (searchState.index < 0) return null;
  return searchState.matches[searchState.index] || null;
}

export function notifyPageRendered({ pageNum, textLayerDiv }) {
  if (!pageNum) return;
  if (textLayerDiv) {
    const text = textLayerDiv.textContent || "";
    searchState.textCache.set(pageNum, { text, lower: text.toLowerCase() });
  }
  const match = getCurrentMatch();
  if (!match || match.pageNum !== pageNum) {
    clearHighlightEls();
    updateStatus();
    return;
  }
  highlightMatch(match, textLayerDiv);
}

export function getSearchQuery() {
  return searchState.query;
}

