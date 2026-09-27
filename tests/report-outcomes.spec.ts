import {test, expect} from '@playwright/test';
import { testRail } from '../testrail-helper';


test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed') {
        const screenshotPath = testInfo.outputPath('failure.png');
        await page.screenshot({ path: screenshotPath });
        testInfo.annotations.push({ type: 'testrail_attachment', description: screenshotPath });
    }
});


// Test 1: Deliberate Pass
test('catalogue page displays the expected heading', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test_id', description: 'C23'});
    await page.setContent('<h1>Catalogue</h1>');
    await expect(page.locator('h1')).toHaveText('Catalogue');
});

// Test 2: Deliberate Fail
test('Deliberate Fail', async ({ page }, testInfo) => {
    testRail('C21');
    await page.setContent('<h1>Catalogue</h1>');
    await expect(page.locator('h1')).toHaveText('Cataloge'); // This will fail
});

// Test 3: Deliberate Skip
test.skip('Deliberate Skip', { annotation: { type: 'test_id', description: 'C22' } }, async ({ page }, testInfo) => {
    await page.setContent('<h1>Catalogue</h1>');
    await expect(page.locator('h1')).toHaveText('Catalogue');
}); 
