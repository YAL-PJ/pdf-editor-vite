// tests/e2e/shortcuts.spec.js
import { test, expect } from '@playwright/test';

async function getSnapEnabled(page) {
  return page.evaluate(() => globalThis.window.__snapGuidesEnabled ?? true);
}
async function pressToggleGuides(page) {
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.down(mod);
  await page.keyboard.press('g');
  await page.keyboard.up(mod);
}
test('Ctrl/Cmd+G toggles guides exactly once per press', async ({ page }) => {
  await page.goto('/');
  const initial = await getSnapEnabled(page);
  await pressToggleGuides(page);
  const after1 = await getSnapEnabled(page);
  expect(after1).toBe(!initial);
  await pressToggleGuides(page);
  const after2 = await getSnapEnabled(page);
  expect(after2).toBe(initial);
});
