import { test, expect } from '@playwright/test';
import { testRail } from '../Utils/testrail-helper';
import fs from 'fs';

test.afterEach(async ({}, testInfo) => {
    if (testInfo.status === 'failed') {
        const screenshot= testInfo.attachments.find(
            (attachment) => attachment.name === 'screenshot' &&
            attachment.contentType === 'image/png' &&
            attachment.path

        );
       
        if (screenshot && screenshot.path) {
            test.info().annotations.push({
                type: 'testrail_attachment',
                description: screenshot.path,
            });
        }
    }
});


test('catalogue-page displays the expected heading', async ({ page }) => {
    testRail('C53');
    await page.setContent('<h1>Catalogue</h1>');
    await expect(page.getByRole('heading', { name: 'Catalogue' })).toBeVisible();
});

test('Deliberate-failure', async ({ page }) => {
    testRail('C54');
    await page.setContent('<h1>Catalogue</h1>');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
   
});

test('deliberate skip', async ({ page }) => {
    testRail('C52');
    test.skip();
});