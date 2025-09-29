import prevIcon from "../../assets/icons/arrow-big-left.svg?raw";
import nextIcon from "../../assets/icons/arrow-big-right.svg?raw";
import zoomOutIcon from "../../assets/icons/zoom-out.svg?raw";
import zoomInIcon from "../../assets/icons/zoom-in.svg?raw";
import selectIcon from "../../assets/icons/mouse-pointer-click.svg?raw";
import highlightIcon from "../../assets/icons/highlighter.svg?raw";
import textHighlightIcon from "../../assets/icons/highlighter-text.svg?raw";
import noteIcon from "../../assets/icons/sticky-note.svg?raw";
import textIcon from "../../assets/icons/type.svg?raw";
import imageIcon from "../../assets/icons/image.svg?raw";
import undoIcon from "../../assets/icons/undo.svg?raw";
import redoIcon from "../../assets/icons/redo.svg?raw";
import historyIcon from "../../assets/icons/history.svg?raw";

const icon = (svg) => `<span class="toolbar-btn__icon" aria-hidden="true">${svg}</span>`;

export function createNavControlsHTML() {
  return `
    <div class="nav-controls">
      <span class="nav-controls__label">Page</span>
      <div class="nav-controls__pager" aria-label="Page navigation">
        <button id="prevPage" type="button" class="nav-btn nav-btn--arrow" aria-label="Previous page">
          ${icon(prevIcon)}
        </button>
        <div class="page-info">
          <label class="sr-only" for="pageNum">Current page</label>
          <input
            id="pageNum"
            class="page-info__field"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            value="1"
            data-current="1"
            aria-label="Current page"
            autocomplete="off"
          />
          <span class="page-info__separator" aria-hidden="true">/</span>
          <span id="pageCount">?</span>
        </div>
        <button id="nextPage" type="button" class="nav-btn nav-btn--arrow" aria-label="Next page">
          ${icon(nextIcon)}
        </button>
      </div>

      <div class="nav-controls__zoom" aria-label="Zoom controls">
        <button id="zoomOut" type="button" class="nav-btn nav-btn--circle" aria-label="Zoom out">
          ${icon(zoomOutIcon)}
        </button>
        <label class="sr-only" for="zoomLevel">Zoom level (percent)</label>
        <input
          id="zoomLevel"
          class="nav-controls__zoom-input"
          type="text"
          inputmode="decimal"
          pattern="[0-9]+([.,][0-9]+)?%?"
          value="100%"
          data-current="100%"
          aria-label="Zoom level (percent)"
          autocomplete="off"
        />
        <button id="zoomIn" type="button" class="nav-btn nav-btn--circle" aria-label="Zoom in">
          ${icon(zoomInIcon)}
        </button>
      </div>

      <div class="nav-controls__search" aria-label="Search document">
        <label class="sr-only" for="searchInput">Search document</label>
        <input
          id="searchInput"
          class="nav-controls__search-input"
          type="search"
          placeholder="Find in document"
          autocomplete="off"
          spellcheck="false"
        />
        <div class="nav-controls__search-buttons">
          <button id="searchPrev" type="button" class="nav-btn nav-btn--square" aria-label="Previous search result">
            ${icon(prevIcon)}
          </button>
          <button id="searchNext" type="button" class="nav-btn nav-btn--square" aria-label="Next search result">
            ${icon(nextIcon)}
          </button>
        </div>
        <span id="searchStatus" class="nav-controls__search-status" aria-live="polite" data-empty="true">0 / 0</span>
        <button id="searchClear" type="button" class="nav-controls__search-clear" aria-label="Clear search">Clear</button>
      </div>
    </div>
  `;
}

export function createHistoryControlsHTML() {
  return `
    <div class="history-controls">
      <div class="history-controls__buttons">
        <button id="btnUndo" type="button" class="toolbar-btn toolbar-btn--compact" aria-label="Undo last action" title="Undo (Ctrl/Cmd+Z)">
          ${icon(undoIcon)}
          <span class="toolbar-btn__label">Undo</span>
        </button>
        <button id="btnRedo" type="button" class="toolbar-btn toolbar-btn--compact" aria-label="Redo last undone action" title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)">
          ${icon(redoIcon)}
          <span class="toolbar-btn__label">Redo</span>
        </button>
        <button id="btnHistoryPanel" type="button" class="toolbar-btn toolbar-btn--compact history-controls__toggle" aria-controls="historyPanel" aria-expanded="false" aria-label="Show edit history">
          ${icon(historyIcon)}
          <span class="toolbar-btn__label">History</span>
        </button>
      </div>
      <div id="historyPanel" class="history-panel" role="dialog" aria-modal="false" aria-labelledby="historyPanelLabel" hidden>
        <header class="history-panel__header">
          <span id="historyPanelLabel">Edit History</span>
          <button id="btnHistoryPanelClose" type="button" class="history-panel__close" aria-label="Close history">&times;</button>
        </header>
        <ul id="historyList" class="history-panel__list"></ul>
      </div>
    </div>
  `;
}

export function createToolbarHTML() {
  return `
    <div class="toolbar" role="toolbar" aria-label="PDF annotation controls">
      <div class="toolbar-tools" role="group" aria-label="Annotation tools">
        <button id="toolSelect" type="button" class="toolbar-btn" aria-label="Select tool" aria-pressed="true">
          ${icon(selectIcon)}
          <span class="toolbar-btn__label">Select</span>
        </button>
        <button id="toolHighlight" type="button" class="toolbar-btn" aria-label="Highlight tool" aria-pressed="false">
          ${icon(highlightIcon)}
          <span class="toolbar-btn__label">Highlight</span>
        </button>
        <button id="toolTextHighlight" type="button" class="toolbar-btn" aria-label="Text highlight tool" aria-pressed="false">
          ${icon(textHighlightIcon)}
          <span class="toolbar-btn__label">Text highlight</span>
        </button>
        <button id="toolNote" type="button" class="toolbar-btn" aria-label="Note tool" aria-pressed="false">
          ${icon(noteIcon)}
          <span class="toolbar-btn__label">Note</span>
        </button>
        <button id="toolText" type="button" class="toolbar-btn" aria-label="Text tool" aria-pressed="false">
          ${icon(textIcon)}
          <span class="toolbar-btn__label">Text</span>
        </button>
        <button id="toolImage" type="button" class="toolbar-btn" aria-label="Insert image tool" aria-pressed="false">
          ${icon(imageIcon)}
          <span class="toolbar-btn__label">Image</span>
        </button>
      </div>

      <input
        id="imagePickerInput"
        type="file"
        accept="image/*"
        style="display: none"
        aria-label="Select image file to insert"
        aria-describedby="imagePickerHelp"
      />
      <div id="imagePickerHelp" class="sr-only">
        Supported formats: JPG, PNG, GIF, WebP
      </div>
    </div>
  `;
}
