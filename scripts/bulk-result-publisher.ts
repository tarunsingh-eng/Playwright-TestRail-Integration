import * as dotenv from 'dotenv';
dotenv.config();

import { TestRailApiClient, TestRailResultPayload } from '../Utils/testrail-api-client';

async function publishResults() {
    const host = process.env.TESTRAIL_HOST;
    const username = process.env.TESTRAIL_USERNAME;
    const apiKey = process.env.TESTRAIL_API_KEY;
    const projectId = Number(process.env.TESTRAIL_PROJECT_ID);
    const suiteId = Number(process.env.TESTRAIL_SUITE_ID);
    const runId = Number(process.env.TESTRAIL_RUN_ID);

    if (!host || !username || !apiKey || !projectId || !suiteId || !runId) {
        console.error('Error: Missing required environment variables. Please check your .env file.');
        process.exit(1);
    }

    const client = new TestRailApiClient({ host, username, apiKey });

    console.log(`Connection to TestRail at ${host}...`);

    const runName = `API Bulk Automation Run - ${new Date().toISOString()}`;
    const runDescription = `Automated execution result published via TypeScript API client.`;
    const caseIds = [101, 102, 103, 104];

    try {
        const run = { id: runId, name: runName };
        console.log(`Created Run R${run.id}: "${run.name}"`);

        const results: TestRailResultPayload[] = [
            {
                case_id: 52,
                status_id: 1,
                comment: 'Test passed successfully.',
                elapsed: '1m',
            },
            {
                case_id: 53,
                status_id: 1,
                comment: 'Product added to cart verified.',
                elapsed: '4s',
            },
            {
                case_id: 54,
                status_id: 5,
                comment: 'Checkout failed: payment gateway timeout.',
                elapsed: '12s',
                defects: 'JIRA-4091',
            },
            {
                case_id: 45,
                status_id: 2,
                comment: 'Blocked: inventory mock service not yet deployed.',
                elapsed: '1s',
            },
        ];

        await client.addResultsForCases(run.id, results);
        console.log(`Published ${results.length} results to Run R${run.id}.`);
    } catch (error) {
        console.error('Error publishing results:', error);
        process.exit(1);
    }
}

publishResults();

