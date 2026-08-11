import * as dotenv from 'dotenv';
dotenv.config();

import { TestRailApiClient, TestRailResultPayload } from './testrail-api-client';

async function publishAutomationRun() {
  const host = process.env.TESTRAIL_HOST || 'https://sandbox.testrail.io';
  const username = process.env.TESTRAIL_USERNAME || 'demo@company.com';
  const apiKey = process.env.TESTRAIL_API_KEY || 'mock-api-key';
  const projectId = Number(process.env.TESTRAIL_PROJECT_ID || 1);

  const client = new TestRailApiClient({ host, username, apiKey });

  console.log(`Connecting to TestRail instance at ${host}...`);

  // Step 1: Create automated run
  const runName = `API Bulk Automation Run - ${new Date().toISOString()}`;
  const runDescription = 'Automated execution results published via TestRail TypeScript API Client.';
  const caseIds = [397, 398, 399, 415];

  try {
    const run = await client.addRun(projectId, runName, runDescription, caseIds);
    console.log(`Successfully created Run R${run.id}: "${run.name}"`);

    // Step 2: Prepare bulk result payloads
    const results: TestRailResultPayload[] = [
      { case_id: 397, status_id: 1, comment: 'Login successful via Playwright chromium.', elapsed: '2s' },
      { case_id: 398, status_id: 1, comment: 'Product added to cart verified.', elapsed: '4s' },
      { case_id: 399, status_id: 5, comment: 'Checkout failed due to payment gateway timeout.', elapsed: '12s', defects: 'JIRA-4091' },
      { case_id: 415, status_id: 2, comment: 'Test blocked pending inventory mock service update.', elapsed: '1s' }
    ];

    // Step 3: Publish bulk results
    await client.addResultsForCases(run.id, results);
    console.log(`Bulk results successfully published to Run R${run.id}.`);
  } catch (error) {
    console.error('Failed to publish automation results:', error);
  }
}

if (require.main === module) {
  publishAutomationRun();
}
