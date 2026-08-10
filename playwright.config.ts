import { defineConfig } from '@playwright/test';

export default defineConfig({
	reporter: [['junit', { outputFile: 'test-results/results.xml' }], 
	['list'],
	['./test-reporter.ts'],
],
	use: { 
	headless: true,
	screenshot: 'only-on-failure',
	},
});