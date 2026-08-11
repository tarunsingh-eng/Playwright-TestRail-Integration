import * as dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import { TestRailApiClient, TestRailResultPayload } from './testrail-api-client';

async function run() {
  const host = process.env.TESTRAIL_HOST;
  const username = process.env.TESTRAIL_USERNAME;
  const apiKey = process.env.TESTRAIL_API_KEY;
  const projectId = Number(process.env.TESTRAIL_PROJECT_ID || 4);
  const runId = Number(process.env.TESTRAIL_RUN_ID);
  
  const jiraHost = process.env.JIRA_HOST;
  const jiraEmail = process.env.JIRA_EMAIL;
  const jiraToken = process.env.JIRA_API_TOKEN;
  const jiraProjectKey = process.env.JIRA_PROJECT_KEY;

  if (!host || !username || !apiKey || !runId) {
    console.error('Missing TestRail environment variables');
    process.exit(1);
  }

  const client = new TestRailApiClient({ host, username, apiKey });
  
  const xmlPath = 'test-results/results.xml';
  if (!fs.existsSync(xmlPath)) {
    console.error('results.xml not found');
    process.exit(1);
  }

  const xml = fs.readFileSync(xmlPath, 'utf-8');
  const testcases = [...xml.matchAll(/<testcase[^>]*>([\s\S]*?)<\/testcase>/g)];
  
  const results: TestRailResultPayload[] = [];
  const jiraAuth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');

  for (const tc of testcases) {
    const tcContent = tc[1];
    const tcStr = tc[0];
    const idMatch = tcStr.match(/<property name=\"test_id\" value=\"C([^\"]+)\"/);
    const nameMatch = tcStr.match(/name=\"([^\"]+)\"/);
    
    if (!idMatch) continue;
    const caseId = Number(idMatch[1]);
    const testName = nameMatch ? nameMatch[1] : `Case C${caseId}`;
    const isFailure = tcContent.includes('<failure');

    let statusId = 1; // Passed
    let defects = undefined;
    let comment = 'Test executed automatically via CI';

    if (isFailure) {
      statusId = 5; // Failed
      comment = 'Test failed in CI execution';
      
      console.log(`Test C${caseId} failed. Creating Jira ticket...`);
      try {
        const res = await fetch(`${jiraHost}/rest/api/2/issue`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${jiraAuth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              project: { key: jiraProjectKey },
              summary: `Automated Test Failed: ${testName}`,
              description: `The automated test C${caseId} failed in GitHub Actions.`,
              issuetype: { name: 'Bug' }
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          defects = data.key; // e.g. QA-123
          console.log(`Successfully created Jira ticket: ${defects}`);
          comment += `\nDefect logged: ${defects}`;
        } else {
          console.error('Failed to create Jira ticket:', await res.text());
        }
      } catch (err) {
        console.error('Error hitting Jira API', err);
      }
    }

    results.push({
      case_id: caseId,
      status_id: statusId,
      comment: comment,
      defects: defects
    });
  }

  console.log('Sending bulk results to TestRail...');
  try {
    await client.addResultsForCases(runId, results);
    console.log('Bulk upload complete.');
  } catch (err) {
    console.error('Failed to upload results to TestRail:', err);
    process.exit(1);
  }
}

run();
