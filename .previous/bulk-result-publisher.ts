import * as dotenv from 'dotenv';

dotenv.config();

import {
    TestRailAPIClient,
    TestRailResultPayload
} from './testrail-api-client';

async function publishAutomationRun() {

    const host = process.env.TESTRAIL_HOST;
    const username = process.env.TESTRAIL_USERNAME;
    const apiKey = process.env.TESTRAIL_API_KEY;
    const projectId = Number(
        process.env.TESTRAIL_PROJECT_ID || 1
    );

    if (!host || !username || !apiKey) {
        throw new Error(
            'Missing TestRail environment variables. Check your .env file.'
        );
    }

    console.log(`Host: ${host}`);
    console.log(`Username: ${username}`);
    console.log(`Project ID: ${projectId}`);

    const client = new TestRailAPIClient({
        host,
        username,
        apiKey,
        projectName: process.env.TESTRAIL_PROJECT,
        milestoneId: process.env.TESTRAIL_MILESTONE,
    });

    // Step 1: Create TestRail run

    console.log('Creating TestRail run...');

    const run = await client.addRun(
        projectId,
        `API Bulk Automation Run - ${new Date().toISOString()}`,
        'Automated via TypeScript API client.',
        [21, 22, 23]
    );

    console.log(
        `Created Run R${run.id}: "${run.name}"`
    );

    // Step 2: Build test results

    const results: TestRailResultPayload[] = [

        {
            case_id: 21,
            status_id: 5,
            comment: 'Deliberate failure verified through Playwright.',
            elapsed: '5 s'
        },

        {
            case_id: 22,
            status_id: 2,
            comment: 'Test was deliberately skipped.',
            elapsed: '5 s'
        },

        {
            case_id: 23,
            status_id: 1,
            comment: 'Catalogue page displays the expected heading.',
            elapsed: '1 s'
        }

    ];

    // Step 3: Upload all results

    console.log(
        `Uploading ${results.length} results...`
    );

    await client.addResultsForCases(
        run.id,
        results
    );

    console.log(
        `Bulk results published successfully to Run R${run.id}.`
    );
}

publishAutomationRun().catch(error => {

    console.error(
        'Bulk publishing failed:'
    );

    console.error(error);

    process.exit(1);
});