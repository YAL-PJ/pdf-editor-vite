import { getHistoryTimeline, HISTORY_UPDATED_EVENT } from "@app/history";

let _toolbarEvtController = null;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatTime = (timestamp) => {
  if (!Number.isFinite(timestamp)) return "";
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
};

const labelAliases = {
  onPrev: "Previous page",
  onNext: "Next page",
  onZoomIn: "Zoomed in",
  onZoomOut: "Zoomed out",
  onImageSelected: "Image ready",
};

const describeLabel = (label, fallback) => {
  if (!label) return fallback;
  return labelAliases[label] || label;
};

const buildHistoryEntries = () => {
  const timeline = getHistoryTimeline();
  if (!timeline) return [];
  const entries = [];
  timeline.past
    .slice()
    .reverse()
    .forEach((entry) => entries.push({ ...entry, type: "past" }));
  if (timeline.present) entries.push({ ...timeline.present, type: "present" });
  timeline.future.forEach((entry) => entries.push({ ...entry, type: "future" }));
  return entries;
};

const statusText = (type) => {
  if (type === "present") return "Current";
  if (type === "future") return "Redo";
  return "Undo";
};

export function attachToolbarEvents(handlers = {}) {
  const safe = (fn) => (typeof fn === "function" ? fn : () => {});
  const log = (msg) => console.log(`[toolbar] ${msg}`);

  if (_toolbarEvtController) _toolbarEvtController.abort();
  _toolbarEvtController = new AbortController();
  const { signal } = _toolbarEvtController;

  const q = (id) => document.getElementById(id);
  const firstEl = (...ids) => ids.map(q).find(Boolean) || null;

  const toolbarEl = q("toolbar");
  if (!toolbarEl) {
    console.warn("[toolbar] #toolbar not found; events not attached");
    return;
  }

  const historyPanelEl = q("historyPanel");
  const historyListEl = q("historyList");
  const historyToggleBtn = q("btnHistoryPanel");
  const historyControlsShell = q("historyControls");

  const updateHistoryButtonState = () => {
    if (!historyToggleBtn) return;
    const timeline = getHistoryTimeline();
    if (!timeline) return;
    const hasOtherEntries =
      (timeline.past?.length || 0) + (timeline.future?.length || 0) > 0;
    const isOpen = historyPanelEl?.classList.contains("history-panel--open");
    historyToggleBtn.disabled = !hasOtherEntries && !isOpen;
  };

  const renderHistoryPanel = () => {
    if (!historyListEl) return;
    const entries = buildHistoryEntries();
    if (!entries.length) {
      historyListEl.innerHTML = '<li class="history-panel__empty">No history yet</li>';
      return;
    }

    historyListEl.innerHTML = entries
      .map((entry) => {
        const disabled = entry.type === "present" ? 'disabled aria-current="true"' : "";
        const metaParts = [statusText(entry.type)];
        const time = formatTime(entry.timestamp);
        if (time) metaParts.push(time);
        const meta = metaParts.join(" | ");
        const label = describeLabel(entry.label, `Edit ${entry.id}`);
        const title =
          entry.type === "future"
            ? "Redo to this point"
            : entry.type === "present"
            ? "Current state"
            : "Revert to this point";
        return `
          <li class="history-panel__item history-panel__item--${entry.type}">
            <button type="button" data-history-id="${entry.id}" data-history-type="${entry.type}" ${disabled} title="${escapeHtml(title)}">
              <span class="history-panel__name">${escapeHtml(label)}</span>
              <span class="history-panel__meta">${escapeHtml(meta)}</span>
            </button>
          </li>`;
      })
      .join("");
  };

  const openHistoryPanel = () => {
    if (!historyPanelEl) return;
    renderHistoryPanel();
    historyPanelEl.hidden = false;
    historyPanelEl.classList.add("history-panel--open");
    historyToggleBtn?.setAttribute("aria-expanded", "true");
    updateHistoryButtonState();
    const focusTarget = historyPanelEl.querySelector("button:not([disabled])");
    focusTarget?.focus?.();
  };

  const closeHistoryPanel = ({ focusToggle } = {}) => {
    if (!historyPanelEl) return;
    historyPanelEl.classList.remove("history-panel--open");
    historyPanelEl.hidden = true;
    historyToggleBtn?.setAttribute("aria-expanded", "false");
    updateHistoryButtonState();
    if (focusToggle && historyToggleBtn) {
      historyToggleBtn.focus();
    }
  };

  const toggleHistoryPanel = () => {
    if (!historyPanelEl) return;
    if (historyPanelEl.classList.contains("history-panel--open")) {
      closeHistoryPanel({ focusToggle: true });
    } else {
      openHistoryPanel();
    }
  };

  const selectHistoryEntry = (entryId) => {
    const handler = safe(handlers.onHistoryJump);
    const result = handler(entryId);
    const finalize = () => {
      renderHistoryPanel();
      updateHistoryButtonState();
      closeHistoryPanel({ focusToggle: true });
    };
    if (result && typeof result.then === "function") {
      result.then(finalize).catch(() => {});
    } else {
      finalize();
    }
  };

  const runDocumentAction = (eventName, handlerName, logLabel) => {
    if (logLabel) log(logLabel);
    requestAnimationFrame(() => {
      document.dispatchEvent(new CustomEvent(eventName));
      safe(handlers[handlerName])();
    });
  };

  const clickActions = {
    prevPage: () => safe(handlers.onPrev)(),
    nextPage: () => safe(handlers.onNext)(),
    zoomIn: () => requestAnimationFrame(() => safe(handlers.onZoomIn)()),
    zoomOut: () => requestAnimationFrame(() => safe(handlers.onZoomOut)()),
    zoomFit: () => requestAnimationFrame(() => safe(handlers.onZoomFit)()),
    toolSelect: () => safe(handlers.onToolChange)(null),
    btnSelect: () => safe(handlers.onToolChange)(null),
    toolHighlight: () => safe(handlers.onToolChange)("highlight"),
    btnHighlight: () => safe(handlers.onToolChange)("highlight"),
    toolNote: () => safe(handlers.onToolChange)("note"),
    btnNote: () => safe(handlers.onToolChange)("note"),
    toolText: () => safe(handlers.onToolChange)("text"),
    btnText: () => safe(handlers.onToolChange)("text"),
    toolImage: () =>
      requestAnimationFrame(() => {
        safe(handlers.onToolChange)("image");
        setTimeout(() => safe(handlers.onPickImage)(), 0);
      }),
    btnImage: () => safe(handlers.onToolChange)("image"),
    btnPickImage: () => safe(handlers.onPickImage)(),
    btnUndo: () => safe(handlers.onUndo)(),
    btnRedo: () => safe(handlers.onRedo)(),
    btnHistoryPanel: () => toggleHistoryPanel(),
    btnHistoryPanelClose: () => closeHistoryPanel({ focusToggle: true }),
    btnDownloadAnnotated: () =>
      runDocumentAction(
        "annotator:download-requested",
        "onDownloadAnnotated",
        "Download annotated"
      ),
    btnPrintAnnotated: () =>
      runDocumentAction(
        "annotator:print-requested",
        "onPrintAnnotated",
        "Print annotated"
      ),
    btnShareAnnotated: () =>
      runDocumentAction(
        "annotator:share-requested",
        "onShareAnnotated",
        "Share annotated"
      ),
    btnSaveLocalAnnotated: () =>
      runDocumentAction(
        "annotator:save-local-requested",
        "onSaveLocalAnnotated",
        "Save annotations locally"
      ),
    btnClearDocument: () => safe(handlers.onClearDocument)(),
  };

  toolbarEl.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest("button");
      if (!btn || !toolbarEl.contains(btn)) return;
      const fn = clickActions[btn.id];
      if (!fn) return;
      e.preventDefault();
      fn();
    },
    { signal }
  );

  const navControlsEl = document.getElementById("navControls");
  if (navControlsEl) {
    navControlsEl.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest("button");
        if (!btn || !navControlsEl.contains(btn)) return;
        const fn = clickActions[btn.id];
        if (!fn) return;
        e.preventDefault();
        fn();
      },
      { signal }
    );
  }

  const resolveResult = (result, onValue, onError) => {
    const apply = (value) => {
      if (value == null) {
        onError?.();
      } else {
        onValue(value);
      }
    };
    if (result && typeof result.then === "function") {
      result.then(apply).catch(() => onError?.());
    } else {
      apply(result);
    }
  };

  const pageInput = q("pageNum");
  if (pageInput) {
    const syncPageDisplay = (value) => {
      const text = String(value ?? pageInput.dataset.current ?? pageInput.value ?? "");
      pageInput.value = text;
      pageInput.dataset.current = text;
    };
    const revertPage = () => syncPageDisplay(pageInput.dataset.current);
    const commitPage = () => {
      const handler = safe(handlers.onPageInput);
      resolveResult(
        handler(pageInput.value),
        (value) => syncPageDisplay(value),
        () => revertPage()
      );
    };

    pageInput.addEventListener(
      "focus",
      () => {
        requestAnimationFrame(() => pageInput.select());
      },
      { signal }
    );

    pageInput.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitPage();
          requestAnimationFrame(() => pageInput.select());
        } else if (e.key === "Escape") {
          e.preventDefault();
          revertPage();
          pageInput.blur();
        }
      },
      { signal }
    );

    pageInput.addEventListener(
      "blur",
      () => {
        commitPage();
      },
      { signal }
    );
  }

  const zoomInput = q("zoomLevel");
  if (zoomInput) {
    const syncZoomDisplay = (value) => {
      const text = String(value ?? zoomInput.dataset.current ?? zoomInput.value ?? "");
      const withSuffix = text.endsWith("%") ? text : `${text.replace(/%+$/, "")}%`;
      zoomInput.value = withSuffix;
      zoomInput.dataset.current = withSuffix;
    };
    const revertZoom = () => syncZoomDisplay(zoomInput.dataset.current);
    const commitZoom = () => {
      const handler = safe(handlers.onZoomInput);
      resolveResult(
        handler(zoomInput.value),
        (value) => syncZoomDisplay(value),
        () => revertZoom()
      );
    };

    zoomInput.addEventListener(
      "focus",
      () => {
        requestAnimationFrame(() => zoomInput.select());
      },
      { signal }
    );

    zoomInput.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitZoom();
          requestAnimationFrame(() => zoomInput.select());
        } else if (e.key === "Escape") {
          e.preventDefault();
          revertZoom();
          zoomInput.blur();
        }
      },
      { signal }
    );

    zoomInput.addEventListener(
      "blur",
      () => {
        commitZoom();
      },
      { signal }
    );
  }

  if (historyControlsShell) {
    historyControlsShell.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest("button");
        if (!btn || !historyControlsShell.contains(btn)) return;
        if (historyPanelEl?.contains(btn)) return;
        const fn = clickActions[btn.id];
        if (!fn) return;
        e.preventDefault();
        fn();
      },
      { signal }
    );
  }

  if (historyPanelEl) {
    historyPanelEl.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        const btn = e.target.closest("button");
        if (!btn || btn.id !== "btnHistoryPanelClose") return;
        e.preventDefault();
        clickActions.btnHistoryPanelClose();
      },
      { signal }
    );
  }

  if (historyListEl) {
    historyListEl.addEventListener(
      "click",
      (e) => {
        const button = e.target.closest("[data-history-id]");
        if (!button) return;
        const entryId = Number(button.getAttribute("data-history-id"));
        if (!Number.isFinite(entryId)) return;
        if (button.disabled || button.getAttribute("aria-current") === "true") return;
        e.preventDefault();
        selectHistoryEntry(entryId);
      },
      { signal }
    );
  }

  document.addEventListener(
    HISTORY_UPDATED_EVENT,
    () => {
      updateHistoryButtonState();
      if (historyPanelEl?.classList.contains("history-panel--open")) {
        renderHistoryPanel();
      }
    },
    { signal }
  );

  document.addEventListener(
    "click",
    (e) => {
      if (!historyPanelEl?.classList.contains("history-panel--open")) return;
      if (historyPanelEl.contains(e.target)) return;
      if (historyToggleBtn?.contains(e.target)) return;
      closeHistoryPanel();
    },
    { signal }
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && historyPanelEl?.classList.contains("history-panel--open")) {
        e.stopPropagation();
        closeHistoryPanel({ focusToggle: true });
      }
    },
    { signal }
  );

  const headerActionButtons = [
    "btnDownloadAnnotated",
    "btnPrintAnnotated",
    "btnShareAnnotated",
    "btnSaveLocalAnnotated",
    "btnClearDocument",
  ];

  headerActionButtons.forEach((id) => {
    const button = q(id);
    if (!button || !clickActions[id]) return;
    button.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        clickActions[id]();
      },
      { signal }
    );
  });

  const picker = firstEl("imagePickerInput", "imagePicker");
  if (picker && handlers.onImageSelected) {
    picker.addEventListener(
      "change",
      async (e) => {
        const file = e.target.files?.[0];
        try {
          if (file) await safe(handlers.onImageSelected)(file);
        } finally {
          try {
            e.target.value = "";
          } catch {}
        }
      },
      { signal }
    );
  }

  const isEditableTarget = (el) => {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return true;
    if (el.getAttribute?.("role") === "textbox") return true;
    if (el.isContentEditable) return true;
    if (el.closest?.("[contenteditable='true']")) return true;
    if (el.closest?.(".text-body[contenteditable='true']")) return true;
    if (el.closest?.(".note-body[contenteditable='true']")) return true;
    return false;
  };

  const onKeyDown = (e) => {
    if (isEditableTarget(e.target)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      safe(handlers.onUndo)();
      return;
    }
    if ((key === "z" && e.shiftKey) || key === "y") {
      e.preventDefault();
      safe(handlers.onRedo)();
    }
  };

  document.addEventListener("keydown", onKeyDown, { signal });

  const undoBtn = q("btnUndo");
  const redoBtn = q("btnRedo");
  if (undoBtn) undoBtn.setAttribute("aria-keyshortcuts", "Ctrl+Z Meta+Z");
  if (redoBtn) redoBtn.setAttribute("aria-keyshortcuts", "Ctrl+Shift+Z Ctrl+Y Meta+Shift+Z");

  updateHistoryButtonState();

  log("events attached (delegated)");
}

if (import.meta?.hot) {
  import.meta.hot.dispose(() => {
    if (_toolbarEvtController) _toolbarEvtController.abort();
    _toolbarEvtController = null;
  });
}

