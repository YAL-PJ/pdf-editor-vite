import { test, expect } from '@playwright/test';

// Measures LCP in a production preview by observing LCP entries.
// Assumes a webServer is configured in the Playwright config to serve dist at baseURL.
test('measure LCP on initial load', async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-ignore
    (window as any).__lcp = { value: 0, entries: [] as any[] };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as any;
      // @ts-ignore
      (window as any).__lcp.value = last.startTime;
      // @ts-ignore
      (window as any).__lcp.entries.push({
        startTime: last.startTime,
        size: last.size,
        element: last?.element ? (last.element as Element).tagName : undefined,
        id: (last as any).id,
        name: (last as any).url || (last as any).name,
      });
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  await page.goto('/');
  await page.waitForLoadState('load');
  // Give the page a short moment to settle any late paints.
  await page.waitForTimeout(1000);

  const result = await page.evaluate(() => (window as any).__lcp);
  const lcpMs = Math.round(result?.value || 0);
  const lastEntry = (result?.entries || []).at(-1);

  console.log(`LCP: ${lcpMs} ms, element: ${lastEntry?.element || 'unknown'}`);

  // Soft sanity check: on local prod preview, LCP for simple H1 should be fast.
  // We don't fail hard to avoid flakiness on slow CI, but we assert it's recorded.
  expect(lcpMs).toBeGreaterThan(0);
});

