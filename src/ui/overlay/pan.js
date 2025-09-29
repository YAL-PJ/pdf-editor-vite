// Drag-to-pan inside the scroll container when the pan tool is active
import { state } from "@app/state";

let installed = false;

export function initPanScroll() {
  if (installed) return;
  installed = true;

  const scroller = () => document.querySelector('.viewer-scroll');
  const isInteractiveTarget = (el) => {
    if (!el) return false;

    // Allow default behaviour for obvious interactive controls inside the viewer shell.
    if (
      el.closest?.(
        'button, [role="button"], a, input, label, textarea, select, .file-input-panel'
      )
    ) {
      return true;
    }

    // Don't hijack drags that start on interactive overlay elements or editors
    return !!(
      el.closest?.('.text-box, .sticky-note, .image-box, .text-header, .text-resize-handle') ||
      el.isContentEditable ||
      el.closest?.('[contenteditable="true"]')
    );
  };

  const onPointerDown = (e) => {
    const container = scroller();
    if (!container) return;

    const scrollTarget = document.scrollingElement || document.documentElement || container;

    // Only left button, only when the pan tool is active
    if (e.button !== 0) return;
    if (state.tool !== "pan") return;
    if (isInteractiveTarget(e.target)) return;

    // Affordance + setup
    container.classList.add('panning');
    try { document.getElementById('annoLayer')?.classList.add('panning'); } catch {}

    const previousBodyScrollBehavior = scrollTarget.style.scrollBehavior || '';
    const previousContainerScrollBehavior = container.style.scrollBehavior || '';
    scrollTarget.style.scrollBehavior = 'auto';
    container.style.scrollBehavior = 'auto';
    e.preventDefault();
    e.stopPropagation();

    const pid = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const startL = scrollTarget.scrollLeft;
    const startT = scrollTarget.scrollTop;

    container.setPointerCapture?.(pid);

    const onMove = (ev) => {
      if (ev.pointerId !== pid) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      scrollTarget.scrollLeft = startL - dx;
      scrollTarget.scrollTop = startT - dy;
      ev.preventDefault();
    };

    const finish = () => {
      try { container.releasePointerCapture?.(pid); } catch {}
      container.classList.remove('panning');
      try { document.getElementById('annoLayer')?.classList.remove('panning'); } catch {}
      scrollTarget.style.scrollBehavior = previousBodyScrollBehavior;
      container.style.scrollBehavior = previousContainerScrollBehavior;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };

    const onUp = (ev) => { if (ev.pointerId === pid) finish(); };
    const onCancel = (ev) => { if (ev.pointerId === pid) finish(); };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onCancel, { passive: true });
  };
  const installIfReady = () => {
    const container = scroller();
    if (!container) return false;
    // HMR-safe: avoid duplicate handler
    container.removeEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointerdown', onPointerDown, { passive: false });
    return true;
  };

  // Try now, and also on DOMContentLoaded if needed
  if (!installIfReady()) {
    window.addEventListener('DOMContentLoaded', installIfReady, { once: true });
  }

  if (import.meta?.hot) {
    import.meta.hot.dispose(() => {
      const c = scroller();
      if (c) c.removeEventListener('pointerdown', onPointerDown);
      installed = false;
    });
  }
}

/**
 * Toggle the visual affordance for panning. Call when tool changes.
 */
export function setPannable(enabled) {
  const c = document.querySelector('.viewer-scroll');
  if (!c) return;
  c.classList.toggle('pannable', !!enabled);
}
