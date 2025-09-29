import { state } from "@app/state";
import { getCachedTextContent, createRangeFromOffsets } from "@pdf/textLayer";

const searchState = {
  query: "",
  matches: [],
  index: -1,
  textCache: new Map(),
  highlightEls: [],
};

function selectMatchRange(range) {
  if (!range || typeof window === "undefined") return;
  if (state.tool) return; // Only auto-select when the Select tool is active
  try {
    const selection = window.getSelection?.();
    if (!selection) return;
    selection.removeAllRanges?.();
    const selectionRange = range.cloneRange ? range.cloneRange() : range;
    selection.addRange?.(selectionRange);
  } catch (err) {
    // Ignore selection failures (e.g., if the document is unfocused)
  }
}

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
  const cachedEntry = getCachedTextContent(pageNum);
  if (cachedEntry && typeof cachedEntry.text === "string") {
    const entry = { text: cachedEntry.text, lower: cachedEntry.text.toLowerCase() };
    searchState.textCache.set(pageNum, entry);
    return entry;
  }
  if (!state.pdfDoc) return { text: "", lower: "" };
  const page = await state.pdfDoc.getPage(pageNum);
  const textContent = await page.getTextContent({ includeMarkedContent: true });
  const text = normalizeTextItems(textContent.items);
  const lower = text.toLowerCase();
  const entry = { text, lower };
  searchState.textCache.set(pageNum, entry);
  return entry;
}

function highlightMatch(match, textLayerDiv) {
  clearHighlightEls();
  const container = document.getElementById("textLayer");
  if (!container || !textLayerDiv || !match) return;
  const layerRect = container.getBoundingClientRect();
  const range = createRangeFromOffsets(textLayerDiv, match.start, match.end);
  if (!range) return;
  selectMatchRange(range);
  const rects = Array.from(range.getClientRects());
  if (!rects.length) return;
  const frag = document.createDocumentFragment();
  let firstRect = null;
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
    if (!firstRect) firstRect = rect;
  }
  container.appendChild(frag);

  if (firstRect) {
    const scrollHost = document.querySelector(".viewer-scroll") || document.scrollingElement;
    if (scrollHost) {
      const hostRect = scrollHost.getBoundingClientRect();
      const currentTop = scrollHost.scrollTop || 0;
      const desiredTop = currentTop + (firstRect.top - hostRect.top);
      const offset = 120;
      const targetTop = Math.max(desiredTop - offset, 0);
      try {
        scrollHost.scrollTo({ top: targetTop, behavior: "smooth" });
      } catch {
        scrollHost.scrollTop = targetTop;
      }
    }
  }
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

export function notifyPageRendered({ pageNum, textLayerDiv, textContent }) {
  if (!pageNum) return;
  const domText = textLayerDiv?.textContent;
  if (typeof domText === "string") {
    const text = domText;
    searchState.textCache.set(pageNum, { text, lower: text.toLowerCase() });
  } else if (textContent && typeof textContent.text === "string") {
    const text = textContent.text;
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
