import { test, expect } from '@playwright/test';
import fs from 'fs';

test.afterEach(async ({}, testInfo) => {
  // Find Playwright's failure screenshot
  if (testInfo.status === 'failed') {
    const screenshot = testInfo.attachments.find(
      (attachment) =>
        attachment.name === 'screenshot' &&
        attachment.contentType === 'image/png' &&
        attachment.path
    );

    if (screenshot?.path) {
      testInfo.annotations.push({
        type: 'testrail_attachment',
        description: screenshot.path,
      });
    }
  }

  // Create test-specific log file
  const safeName = testInfo.title
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

  const logFile = testInfo.outputPath(`${safeName}.log`);

  let log = '';

  log += `Test: ${testInfo.title}\n`;
  log += `Status: ${testInfo.status}\n`;
  log += `Duration: ${testInfo.duration}ms\n\n`;

  if (testInfo.errors.length > 0) {
    for (const error of testInfo.errors) {
      log += `ERROR:\n`;
      log += `${error.message}\n\n`;
      log += `STACK:\n`;
      log += `${error.stack ?? ''}\n\n`;
    }
  }

  await fs.promises.writeFile(logFile, log, 'utf8');

  // Attach the log to this TestRail result
  testInfo.annotations.push({
    type: 'testrail_attachment',
    description: logFile,
  });

  console.log(`Log created: ${logFile}`);
});

test('catalogue page displays the expected heading', async ({ page }) => {
  test.info().annotations.push({
    type: 'test_id',
    description: 'C398',
  });

  await page.setContent('<h1>Catalogue</h1>');

  await expect(
    page.getByRole('heading', { name: 'Catalogue' })
  ).toBeVisible();
});

test('deliberate failure shows how XML stores a failure', async ({ page }) => {
  test.info().annotations.push({
    type: 'test_id',
    description: 'C399',
  });

  await page.setContent('<h1>Catalogue</h1>');

  await expect(
    page.getByRole('heading', { name: 'Checkout' })
  ).toBeVisible();
});

test.skip('deliberate skip shows a third status', async () => {
  test.info().annotations.push({
    type: 'test_id',
    description: 'C397',
  });
});