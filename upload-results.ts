import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import * as path from 'path';

dotenv.config();

const host = process.env.TESTRAIL_HOST;
const username = process.env.TESTRAIL_USERNAME;
const apiKey = process.env.TESTRAIL_API_KEY;
const projectName = process.env.TESTRAIL_PROJECT;   
const milestoneId = process.env.TESTRAIL_MILESTONE;

console.log(`Project Name: ${projectName}`);
console.log(`Host: ${host}`);
console.log(`Username: ${username}`);
console.log(`Milestone ID: ${milestoneId}`);


if (!host || !username || !apiKey || !projectName) {
    console.error('Error: Missing required environment variables. Please check your .env file.');
    process.exit(1);
}

// Build trcli command 
const command = [
'trcli -y',
`--host ${host}`,
`--username ${username}`,
`--password ${apiKey}`,
`--project "${projectName}"`,
'parse_junit',
//`--run-id 29`,
'--title "GitHub Tests_2.1_27-09-2023_11:30AM"',
//$(git rev-parse --short HEAD)
'--run-description "Browser: chromium | Env: local | Branch: $(git branch --show-current)"',
`--milestone-id ${milestoneId}`,
`--file "${path.resolve('test-results/results.xml')}"`,
'--case-matcher "property"'
].join(' ');


console.log('Starting TestRail upload via TRCLI...');

try {
    execSync(command, { stdio: 'inherit' });
    console.log('Test results uploaded to TestRail successfully.');
} catch (error) {
    console.error('Error uploading test results to TestRail:', error);
    process.exit(1);
}
