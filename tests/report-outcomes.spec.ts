import { test, expect } from '@playwright/test';

test('catalogue page displays the expected heading', async ({ page }) => {
  await page.setContent('<h1>Catalogue</h1>');
  await expect(page.getByRole('heading', { name: 'Catalogue' })).toBeVisible();
});

test('deliberate failure shows how XML stores a failure', async ({ page }) => {
  await page.setContent('<h1>Catalogue</h1>');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
});

test.skip('deliberate skip shows a third status', async () => {});
