import { defineConfig } from '@playwright/test';

export default defineConfig({
	reporter: [['junit', { outputFile: 'test-results/results.xml' }], 
['list']],
	use: { headless: true }, 
});