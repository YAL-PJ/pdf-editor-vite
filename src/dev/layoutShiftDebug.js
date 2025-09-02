export function installLayoutShiftLogger() {
  if (!('PerformanceObserver' in window)) return;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput && entry.value > 0) {
          console.log('[CLS] value:', entry.value, entry.sources?.map(s => s.node));
        }
      }
    });
    po.observe({ type: 'layout-shift', buffered: true });
    if (import.meta?.hot) import.meta.hot.dispose(() => po.disconnect());
  } catch {}
}
