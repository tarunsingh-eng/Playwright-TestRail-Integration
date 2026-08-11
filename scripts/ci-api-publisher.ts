import * as dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
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

  if (!host || !username || !apiKey) {
    console.error('Missing TestRail environment variables');
    process.exit(1);
  }

  const cleanHost = host.replace(/\/+$/, '');
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
  
  // Keep track of attachments and Jira defects per case
  const attachmentsByCase: Record<number, string[]> = {};
  const caseIdToDefect: Record<number, string> = {};

  for (const tc of testcases) {
    const tcContent = tc[1];
    const tcStr = tc[0];
    const idMatch = tcStr.match(/<property name=\"test_id\" value=\"C([^\"]+)\"/);
    const nameMatch = tcStr.match(/name=\"([^\"]+)\"/);
    
    if (!idMatch) continue;
    const caseId = Number(idMatch[1]);
    const testName = nameMatch ? nameMatch[1] : `Case C${caseId}`;
    const isFailure = tcContent.includes('<failure');

    // Parse attachments
    const attachmentMatches = [...tcContent.matchAll(/<property name=\"testrail_attachment\" value=\"([^\"]+)\"/g)];
    const attachments = attachmentMatches.map(m => m[1]);
    if (attachments.length > 0) {
        attachmentsByCase[caseId] = attachments;
    }

    let statusId = 1; // Passed
    let defects = undefined;
    let comment = 'Test executed automatically via CI';

    if (isFailure) {
      statusId = 5; // Failed
      comment = 'Test case failed.';
      
      // Parse error trace for Jira
      let errorTrace = 'No error trace found.';
      const failureMatch = tcContent.match(/<failure[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/failure>/);
      if (failureMatch) {
          errorTrace = failureMatch[1].trim().substring(0, 10000); 
      }
      
      // Mimic TRCLI attachment comment
      if (attachments.length > 0) {
          comment = 'Test case failed. Screenshot and log attached. Text:\n' + comment;
      }
      
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
              description: `The automated test C${caseId} failed in GitHub Actions.\n\n*Error Trace:*\n{code}\n${errorTrace}\n{code}`,
              issuetype: { name: 'Bug' }
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          defects = data.key; // e.g. QA-123
          caseIdToDefect[caseId] = defects;
          
          console.log(`Successfully created Jira ticket: ${defects}`);
          comment += `\n\nDefect logged: ${defects}`;
          
          // Upload attachments to Jira ticket
          if (attachments.length > 0) {
            console.log(`Uploading ${attachments.length} attachments to Jira ticket ${defects}...`);
            for (const filePath of attachments) {
              if (fs.existsSync(filePath)) {
                const buffer = fs.readFileSync(filePath);
                const blob = new Blob([buffer]);
                const formData = new FormData();
                formData.append('file', blob, path.basename(filePath));
                
                const attachRes = await fetch(`${jiraHost}/rest/api/2/issue/${defects}/attachments`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Basic ${jiraAuth}`,
                    'X-Atlassian-Token': 'no-check',
                    'User-Agent': 'TestRail-Automation-Client/1.0'
                  },
                  body: formData
                });
                if (!attachRes.ok) {
                  console.error(`Failed to upload ${path.basename(filePath)} to Jira:`, await attachRes.text());
                } else {
                  console.log(`Successfully attached ${path.basename(filePath)} to Jira ticket ${defects}`);
                }
              }
            }
          }
          
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
  let uploadedResults: any[] = [];
  let finalRunId = runId;
  const caseIdsToInclude = results.map(r => r.case_id);
  
  try {
    uploadedResults = await client.addResultsForCases(finalRunId, results);
    console.log('Bulk upload complete.');
  } catch (err: any) {
    if (err.message.includes('not a valid test run') || !finalRunId) {
      console.log(`Run ID ${finalRunId || 'missing'} is invalid or missing. Creating a new test run in Project ${projectId}...`);
      try {
        const newRun = await client.addRun(projectId, `Automated API Run - ${new Date().toLocaleDateString()}`, undefined, caseIdsToInclude);
        finalRunId = newRun.id;
        console.log(`Created new run ID: ${finalRunId}`);
        
        uploadedResults = await client.addResultsForCases(finalRunId, results);
        console.log('Bulk upload to new run complete.');
      } catch (createErr) {
        console.error('Failed to create new run or upload results:', createErr);
        process.exit(1);
      }
    } else {
      console.error('Failed to upload results to TestRail:', err);
      process.exit(1);
    }
  }

  // Fetch tests to map Case IDs to Test IDs and Result IDs
  console.log('Fetching tests in run to map case IDs to result IDs...');
  const testsResponse = await client.getTests(finalRunId) as any;
  const testsInRun = Array.isArray(testsResponse) ? testsResponse : (testsResponse.tests || []);
  
  const caseToTestMap: Record<number, number> = {};
  for (const t of testsInRun) {
      caseToTestMap[t.case_id] = t.id;
  }

  const testToResultMap: Record<number, number> = {};
  for (const r of uploadedResults) {
      testToResultMap[r.test_id] = r.id;
  }

  // 1. Upload attachments to TestRail
  const casesWithAttachments = Object.keys(attachmentsByCase);
  for (const caseIdStr of casesWithAttachments) {
      const caseId = Number(caseIdStr);
      const testId = caseToTestMap[caseId];
      if (!testId) continue;
      
      const resultId = testToResultMap[testId];
      if (!resultId) continue;

      for (const filePath of attachmentsByCase[caseId]) {
          if (fs.existsSync(filePath)) {
              console.log(`Uploading attachment for C${caseId} -> Result ID ${resultId}: ${path.basename(filePath)}`);
              try {
                  await client.addAttachmentToResult(resultId, filePath);
              } catch (err) {
                  console.error(`Failed to upload ${filePath}:`, err);
              }
          }
      }
  }
  
  // 2. Add Remote Web Links to Jira using the actual Test ID
  for (const caseIdStr of Object.keys(caseIdToDefect)) {
      const caseId = Number(caseIdStr);
      const defectId = caseIdToDefect[caseId];
      const testId = caseToTestMap[caseId];
      
      if (!defectId || !testId) continue;
      
      const testLink = `${cleanHost}/index.php?/tests/view/${testId}`;
      console.log(`Adding Web Link to Jira ticket ${defectId} for Test ID T${testId}...`);
      
      try {
        const linkRes = await fetch(`${jiraHost}/rest/api/2/issue/${defectId}/remotelink`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${jiraAuth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                object: {
                    url: testLink,
                    title: `Test T${testId} (Run ${finalRunId})`
                }
            })
        });
        
        if (!linkRes.ok) {
            console.error(`Failed to add Web Link to Jira ticket ${defectId}:`, await linkRes.text());
        } else {
            console.log(`Successfully linked T${testId} to Jira ticket ${defectId}`);
        }
      } catch (err) {
          console.error(`Error adding Web Link to Jira ticket ${defectId}:`, err);
      }
  }
}

run();
