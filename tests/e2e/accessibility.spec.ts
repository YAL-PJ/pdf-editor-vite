
import { test, expect } from '@playwright/test';

test('app shell accessibility', async ({ page }) => {
  // Navigate to the app's root URL.
  // NOTE: This assumes your dev server runs on http://localhost:5173/
  await page.goto('http://localhost:5173/');

  // Assert that the toolbar is visible and has the correct ARIA role/label.
  await expect(page.getByRole('toolbar', { name: /annotation toolbar/i })).toBeVisible();

  // Assert that the file input is visible and has the correct ARIA label.
  await expect(page.getByLabel(/select pdf file/i)).toBeVisible();

  // Assert that the main PDF canvas element is present and visible.
  await expect(page.locator('#pdfCanvas')).toBeVisible();
});