import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import * as path from 'path';

dotenv.config();

const host = process.env.TESTRAIL_HOST;
const username = process.env.TESTRAIL_USERNAME;
const apiKey = process.env.TESTRAIL_API_KEY;
const project = process.env.TESTRAIL_PROJECT;   
//const milestoneId = process.env.TESTRAIL_MILESTONE;

if (!host || !username || !apiKey || !project) {
    console.error('Error: Missing required environment variables. Please check your .env file.');
    process.exit(1);
}

// Build trcli command

const command = [
    'trcli -y',
    `--host ${host}`,
    `--username "${username}"`,
    `--password "${apiKey}"`,
    `--project "${project}"`,
     'parse_junit',
    `--title "Smoke 2.1 - Oct"`,
    //`--run-id 69`,
   // `--milestone-id 2`,
    //`--run-description "Build: local-demo | Ref: feature/training | Browser: chromium | Env: local | OS: Windows 10"`,
    ` --file "${path.resolve('test-results/results.xml')}"`,
    `--case-matcher property`
].join(' ');

console.log('Starting TestRail upload via TRCLI...');

try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
        console.log('Test results uploaded to TestRail successfully.');
        console.log(output);
     } catch (error: any) {
        console.error('Upload failed');
        if (error.stdout) { console.error(error.stdout); }
        if (error.stderr) { console.error(error.stderr); }
        process.exit(1);
    }
