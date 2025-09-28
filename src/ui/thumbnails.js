const THUMB_TARGET_WIDTH = 140;
const THUMB_MAX_DPR = 2;

let paneEl = null;
let listEl = null;
let toggleButton = null;
let showButton = null;
let onSelectPage = null;
let activePage = null;
let abortController = null;
let renderGeneration = 0;
let collapsed = false;

const asNumber = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

function ensureElements() {
  if (!paneEl) paneEl = document.getElementById("thumbnailPane");
  if (!listEl) listEl = document.getElementById("thumbnailList");
  if (!toggleButton) toggleButton = document.getElementById("thumbnailPaneToggle");
  if (!showButton) showButton = document.getElementById("thumbnailPaneShow");
  return Boolean(paneEl && listEl && toggleButton && showButton);
}

function hasThumbnails() {
  return Boolean(listEl && listEl.children.length > 0);
}

function applyVisibility() {
  if (!paneEl || !showButton) return;
  const body = document.body;
  const hasContent = hasThumbnails();

  if (!hasContent) {
    paneEl.hidden = true;
    showButton.hidden = true;
    toggleButton?.setAttribute("aria-expanded", "false");
    showButton?.setAttribute("aria-expanded", "false");
    toggleButton?.setAttribute("aria-label", "Hide page thumbnails");
    if (toggleButton) toggleButton.textContent = "Hide";
    body?.removeAttribute("data-thumbnails");
    return;
  }

  if (collapsed) {
    paneEl.hidden = true;
    showButton.hidden = false;
    toggleButton?.setAttribute("aria-expanded", "false");
    toggleButton?.setAttribute("aria-label", "Show page thumbnails");
    if (toggleButton) toggleButton.textContent = "Show";
    showButton?.setAttribute("aria-expanded", "false");
    body?.setAttribute("data-thumbnails", "collapsed");
  } else {
    paneEl.hidden = false;
    showButton.hidden = true;
    toggleButton?.setAttribute("aria-expanded", "true");
    toggleButton?.setAttribute("aria-label", "Hide page thumbnails");
    if (toggleButton) toggleButton.textContent = "Hide";
    showButton?.setAttribute("aria-expanded", "true");
    body?.setAttribute("data-thumbnails", "open");
  }
}

function setCollapsed(next) {
  const desired = Boolean(next);
  if (desired === collapsed) return;
  collapsed = desired;
  applyVisibility();

  if (collapsed) {
    showButton?.focus?.();
  } else {
    const active = listEl?.querySelector(".thumbnail-item.is-active");
    active?.focus?.();
  }
}

function handleClick(event) {
  if (!listEl || !onSelectPage) return;
  const target = event.target.closest("[data-page]");
  if (!target || !listEl.contains(target)) return;
  const page = asNumber(target.dataset.page);
  if (!page) return;
  event.preventDefault();
  onSelectPage(page);
}

export function initThumbnailPane({ onPageSelect } = {}) {
  if (!ensureElements()) {
    console.warn("[thumbnails] Pane elements missing in DOM");
    return;
  }

  onSelectPage = typeof onPageSelect === "function" ? onPageSelect : null;

  if (abortController) abortController.abort();
  abortController = new AbortController();
  const { signal } = abortController;

  listEl.addEventListener("click", handleClick, { signal });
  toggleButton.addEventListener(
    "click",
    () => setCollapsed(!collapsed),
    { signal }
  );
  showButton.addEventListener(
    "click",
    () => setCollapsed(false),
    { signal }
  );

  applyVisibility();
}

export function clearThumbnails() {
  if (!ensureElements()) return;
  renderGeneration += 1;
  activePage = null;
  listEl.innerHTML = "";
  listEl.removeAttribute("aria-busy");
  applyVisibility();
}

export function setActiveThumbnail(pageNum) {
  if (!ensureElements()) return;
  const next = asNumber(pageNum);
  if (!next || next === activePage) return;

  if (activePage) {
    const prevEl = listEl.querySelector(`[data-page="${activePage}"]`);
    if (prevEl) {
      prevEl.classList.remove("is-active");
      prevEl.removeAttribute("aria-current");
    }
  }

  const nextEl = listEl.querySelector(`[data-page="${next}"]`);
  if (nextEl) {
    nextEl.classList.add("is-active");
    nextEl.setAttribute("aria-current", "true");
    if (!paneEl?.hidden) {
      nextEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  activePage = next;
}

async function renderSingleThumbnail(pdfDoc, pageNum, generation) {
  if (generation !== renderGeneration) return;
  const page = await pdfDoc.getPage(pageNum);
  if (generation !== renderGeneration) return;

  const viewport = page.getViewport({ scale: 1 });
  const scale = THUMB_TARGET_WIDTH / viewport.width;
  const thumbViewport = page.getViewport({ scale });

  const dpr = Math.min(THUMB_MAX_DPR, window.devicePixelRatio || 1);
  const width = Math.ceil(thumbViewport.width);
  const height = Math.ceil(thumbViewport.height);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const renderTask = page.render({ canvasContext: ctx, viewport: thumbViewport, intent: "display" });
  await renderTask.promise;
  if (generation !== renderGeneration) return;

  const url = canvas.toDataURL("image/png");
  canvas.width = 0;
  canvas.height = 0;

  const item = listEl?.querySelector(`[data-page="${pageNum}"]`);
  if (!item || generation !== renderGeneration) return;

  const imageHost = item.querySelector(".thumbnail-item__image");
  if (!imageHost) return;

  const skeleton = imageHost.querySelector(".thumbnail-item__skeleton");
  skeleton?.remove();

  const img = document.createElement("img");
  img.src = url;
  img.alt = `Page ${pageNum}`;
  img.decoding = "async";
  img.loading = "lazy";
  img.draggable = false;
  imageHost.appendChild(img);

  item.dataset.loading = "false";
}

export async function renderThumbnails(pdfDoc, { currentPage } = {}) {
  if (!ensureElements()) return;
  if (!pdfDoc) {
    clearThumbnails();
    return;
  }

  renderGeneration += 1;
  const generation = renderGeneration;
  const totalPages = pdfDoc.numPages || 0;
  listEl.setAttribute("aria-busy", "true");
  listEl.innerHTML = "";

  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    if (generation !== renderGeneration) return;

    const item = document.createElement("button");
    item.type = "button";
    item.className = "thumbnail-item";
    item.dataset.page = String(pageNum);
    item.dataset.loading = "true";
    item.setAttribute("role", "listitem");
    item.setAttribute("aria-label", `Go to page ${pageNum}`);

    const image = document.createElement("div");
    image.className = "thumbnail-item__image";
    const skeleton = document.createElement("div");
    skeleton.className = "thumbnail-item__skeleton";
    image.appendChild(skeleton);

    const badge = document.createElement("span");
    badge.className = "thumbnail-badge";
    badge.textContent = String(pageNum);
    badge.setAttribute("aria-hidden", "true");

    item.append(image, badge);
    listEl.appendChild(item);
  }

  if (generation === renderGeneration) {
    applyVisibility();
  }

  const renderQueue = Array.from({ length: totalPages }, (_, i) => i + 1);
  for (const pageNum of renderQueue) {
    if (generation !== renderGeneration) return;
    try {
      await renderSingleThumbnail(pdfDoc, pageNum, generation);
    } catch (error) {
      console.warn("[thumbnails] Failed to render page", pageNum, error);
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  if (generation === renderGeneration) {
    listEl.removeAttribute("aria-busy");
    applyVisibility();
  }

  if (generation === renderGeneration && currentPage) {
    setActiveThumbnail(currentPage);
  }
}
