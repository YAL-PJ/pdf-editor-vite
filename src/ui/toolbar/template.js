import prevIcon from "../../assets/icons/arrow-big-left.svg?raw";
import nextIcon from "../../assets/icons/arrow-big-right.svg?raw";
import zoomOutIcon from "../../assets/icons/zoom-out.svg?raw";
import zoomInIcon from "../../assets/icons/zoom-in.svg?raw";
import selectIcon from "../../assets/icons/mouse-pointer-click.svg?raw";
import highlightIcon from "../../assets/icons/highlighter.svg?raw";
import noteIcon from "../../assets/icons/sticky-note.svg?raw";
import textIcon from "../../assets/icons/type.svg?raw";
import imageIcon from "../../assets/icons/image.svg?raw";
import undoIcon from "../../assets/icons/undo.svg?raw";
import redoIcon from "../../assets/icons/redo.svg?raw";
import downloadIcon from "../../assets/icons/download.svg?raw";

const icon = (svg) => `<span class="toolbar-btn__icon" aria-hidden="true">${svg}</span>`;

/**
 * HTML template generation for toolbar
 */
export function createToolbarHTML() {
  return `
    <div class="toolbar" role="toolbar" aria-label="PDF viewer controls">
      <div class="toolbar-group" aria-label="Page navigation">
        <button id="prevPage" type="button" class="toolbar-btn toolbar-btn--compact toolbar-btn--icon-row" aria-label="Previous page">
          ${icon(prevIcon)}
          <span class="toolbar-btn__label">Prev</span>
        </button>
        <span class="page-info">
          Page <span id="pageNum" aria-live="polite">1</span> / <span id="pageCount">?</span>
        </span>
        <button id="nextPage" type="button" class="toolbar-btn toolbar-btn--compact toolbar-btn--icon-row" aria-label="Next page">
          ${icon(nextIcon)}
          <span class="toolbar-btn__label">Next</span>
        </button>
      </div>

      <div class="toolbar-group" aria-label="Zoom controls">
        <button id="zoomOut" type="button" class="toolbar-btn toolbar-btn--compact" aria-label="Zoom out">
          ${icon(zoomOutIcon)}
          <span class="toolbar-btn__label">Zoom out</span>
        </button>
        <span id="zoomLevel" aria-live="polite">100%</span>
        <button id="zoomIn" type="button" class="toolbar-btn toolbar-btn--compact" aria-label="Zoom in">
          ${icon(zoomInIcon)}
          <span class="toolbar-btn__label">Zoom in</span>
        </button>
      </div>

      <div class="toolbar-group" role="group" aria-label="Annotation tools">
        <button id="toolSelect" type="button" class="toolbar-btn" aria-label="Select tool" aria-pressed="true">
          ${icon(selectIcon)}
          <span class="toolbar-btn__label">Select</span>
        </button>
        <button id="toolHighlight" type="button" class="toolbar-btn" aria-label="Highlight tool" aria-pressed="false">
          ${icon(highlightIcon)}
          <span class="toolbar-btn__label">Highlight</span>
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

      <div class="toolbar-group" aria-label="History controls">
        <button id="btnUndo" type="button" class="toolbar-btn toolbar-btn--compact" aria-label="Undo last action" title="Undo (Ctrl/Cmd+Z)">
          ${icon(undoIcon)}
          <span class="toolbar-btn__label">Undo</span>
        </button>
        <button id="btnRedo" type="button" class="toolbar-btn toolbar-btn--compact" aria-label="Redo last undone action" title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)">
          ${icon(redoIcon)}
          <span class="toolbar-btn__label">Redo</span>
        </button>
      </div>

      <div class="toolbar-group" aria-label="Export options">
        <button id="btnDownloadAnnotated" type="button" class="toolbar-btn toolbar-btn--icon-row" aria-label="Download PDF with annotations" title="Download PDF with annotations">
          ${icon(downloadIcon)}
          <span class="toolbar-btn__label">Download</span>
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
