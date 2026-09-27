import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    reporter: [
        ['list'], ['junit', { outputFile: 'test-results/results.xml', embedAnnotationsAsProperties: true }], 
    ],

    use: {
        headless: true,
        screenshot: 'only-on-failure',
    },
});