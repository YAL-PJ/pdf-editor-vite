/**
 * HTML template generation for toolbar
 */
export function createToolbarHTML() {
  return `
    <div class="toolbar" role="toolbar" aria-label="PDF viewer controls">
      <div class="toolbar-group">
        <button id="prevPage" type="button" aria-label="Previous page">◀ Prev</button>
        <span class="page-info">
          Page <span id="pageNum" aria-live="polite">1</span> / <span id="pageCount">?</span>
        </span>
        <button id="nextPage" type="button" aria-label="Next page">Next ▶</button>
      </div>

      <div class="toolbar-group">
        <button id="zoomOut" type="button" aria-label="Zoom out">−</button>
        <span id="zoomLevel" aria-live="polite">100%</span>
        <button id="zoomIn" type="button" aria-label="Zoom in">+</button>
      </div>

      <div class="toolbar-group" role="group" aria-label="Annotation tools">
        <button id="toolSelect"    type="button" aria-label="Select tool"         aria-pressed="true">↖ Select</button>
        <button id="toolHighlight" type="button" aria-label="Highlight tool"      aria-pressed="false">🖍 Highlight</button>
        <button id="toolNote"      type="button" aria-label="Note tool"           aria-pressed="false">📝 Note</button>
        <button id="toolText"      type="button" aria-label="Text tool"           aria-pressed="false">✒ Text</button>
        <button id="toolImage"     type="button" aria-label="Insert image tool"   aria-pressed="false">🖼 Image</button>
      </div>

      <div class="toolbar-group">
        <button id="btnUndo" type="button" aria-label="Undo last action" title="Undo (Ctrl/Cmd+Z)">↩ Undo</button>
        <button id="btnRedo" type="button" aria-label="Redo last undone action" title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)">↪ Redo</button>
      </div>

      <div class="toolbar-group">
        <button id="btnDownloadAnnotated" type="button" aria-label="Download PDF with annotations" title="Download PDF with annotations">
          💾 Download (annotated)
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
