/**
 * post-bugs-and-enrich-xml.ts
 *
 * PURPOSE
 * -------
 * This script is the BRIDGE between Jira and TestRail.
 * It runs AFTER Playwright writes the JUnit XML and BEFORE TRCLI uploads results.
 *
 * WHAT IT DOES — three steps in sequence:
 *   1. Read the JUnit XML produced by Playwright.
 *   2. For every <testcase> that has a <failure>, create a Jira bug and collect the key (e.g. "QA-42").
 *   3. Write that bug key back into the XML as a property: <property name="defects" value="QA-42"/>.
 *
 * WHY THIS MATTERS
 * ----------------
 * TRCLI reads the "defects" property from the XML and populates the Defects field on the
 * TestRail result automatically. The result is:
 *   - TestRail result → Defects field shows "QA-42" as a clickable link.
 *   - Jira ticket QA-42 → contains the test name, failure trace, and a screenshot attachment.
 *   - Both systems are updated in ONE automated pipeline step — no manual copy-paste.
 *
 * EXECUTION ORDER IN YOUR PIPELINE
 * ---------------------------------
 *   1. npx playwright test                           <- produces results.xml
 *   2. npx tsx post-bugs-and-enrich-xml.ts           <- THIS SCRIPT (posts bugs, enriches XML)
 *   3. trcli parse_junit ...                         <- uploads enriched XML to TestRail
 *
 * ENVIRONMENT VARIABLES REQUIRED
 * --------------------------------
 *   JIRA_BASE_URL        e.g. https://your-domain.atlassian.net
 *   JIRA_EMAIL           service account email
 *   JIRA_API_TOKEN       Jira API token (not password)
 *   JIRA_PROJECT_KEY     e.g. QA
 *   JUNIT_REPORT_PATH    path to the XML (default: test-results/results.xml)
 */

import fs from 'fs';
import path from 'path';
import { parseStringPromise, Builder } from 'xml2js';

// Reuse the Jira helpers built in jira-bug-creator.ts — no need to rewrite them.
import { JIRA_BASE_URL, JIRA_PROJECT_KEY, createJiraBug, attachScreenshotsToJira, testJiraConnection } from './Jira-bug-creator';

// Path to the JUnit XML written by Playwright
const JUNIT_REPORT_PATH = process.env.JUNIT_REPORT_PATH
  ?? path.join(process.cwd(), 'test-results', 'results.xml');

// ---------------------------------------------------------------------------
// STEP 1 — Read and parse the JUnit XML
// ---------------------------------------------------------------------------
async function readXml(): Promise<any> {
  if (!fs.existsSync(JUNIT_REPORT_PATH)) {
    throw new Error(`JUnit report not found at: ${JUNIT_REPORT_PATH}\nDid Playwright run successfully?`);
  }
  const raw = fs.readFileSync(JUNIT_REPORT_PATH, 'utf-8');
  return parseStringPromise(raw, { explicitArray: true });
}

// ---------------------------------------------------------------------------
// STEP 3 — Inject the Jira bug key back into the XML as a <property> tag
//
// TRCLI looks for: <property name="defects" value="QA-42"/>
// inside the <properties> block of each <testcase>.
//
// If the <properties> block does not exist yet, we create it.
// ---------------------------------------------------------------------------
function injectDefectIntoTestcase(testcase: any, issueKey: string): void {
  if (!testcase.properties) {
    testcase.properties = [{ property: [] }];
  }

  if (!testcase.properties[0].property) {
    testcase.properties[0].property = [];
  }

  const properties = testcase.properties[0].property;

  // Look for an existing TestRail result field
  const existing = properties.find(
    (p: any) =>
      p.$?.name === 'testrail_result_field' &&
      p.$?.value?.startsWith('defects:')
  );

  if (existing) {
    const existingKeys = existing.$.value
      .substring('defects:'.length)
      .split(',')
      .map((key: string) => key.trim())
      .filter(Boolean);

    if (!existingKeys.includes(issueKey)) {
      existing.$.value = `defects:${[...existingKeys, issueKey].join(',')}`;
    }
  } else {
    properties.push({
      $: {
        name: 'testrail_result_field',
        value: `defects:${issueKey}`
      }
    });
  }
}

// ---------------------------------------------------------------------------
// MAIN ORCHESTRATION — ties everything together
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('\npost-bugs-and-enrich-xml — starting\n');
  console.log(`   XML path : ${JUNIT_REPORT_PATH}`);
  console.log(`   Jira org : ${JIRA_BASE_URL}`);
  console.log(`   Project  : ${JIRA_PROJECT_KEY}\n`);

  // --- STEP 1: Parse XML ---
  const parsed = await readXml();

  // --- STEP 0: Verify Jira connection before touching anything ---
  const jiraReady = await testJiraConnection();
  if (!jiraReady) {
    console.error('\nStopping: Jira connection check failed. Fix credentials and retry.');
    process.exit(1);
  }

  // JUnit XML can have either <testsuites><testsuite>... or just <testsuite>...
  const suites: any[] =
    parsed.testsuites?.testsuite ??
    (parsed.testsuite ? [parsed.testsuite] : []);

  if (suites.length === 0) {
    console.warn('No test suites found in the XML. Nothing to process.');
    return;
  }

  let bugsCreated = 0;
  let failuresFound = 0;

  // --- STEP 2 & 3: For each failed testcase → create bug → inject into XML ---
  for (const suite of suites) {
    const testcases: any[] = suite.testcase ?? [];

    for (const tc of testcases) {
      if (!tc.failure) continue;  // Only process failures

      failuresFound++;
      const testName = tc.$.name as string;
      const failureTrace = (tc.failure[0]._ ?? tc.failure[0].$.message ?? 'No trace available') as string;

      console.log(`\nFailed test: "${testName}"`);

      // Post bug to Jira — imported from jira-utils.ts
      const issueKey = await createJiraBug(testName, failureTrace);

      if (issueKey) {
        bugsCreated++;

        // Attach screenshots — imported from jira-utils.ts
        await attachScreenshotsToJira(issueKey, testName);

        // Inject the bug key into the XML tree (in-memory) — NEW in this script
        injectDefectIntoTestcase(tc, issueKey);

        console.log(`  "${testName}" -> ${issueKey} (will appear in TestRail Defects field)`);
      }
    }
  }

  // --- Write the enriched XML back to disk ---
  if (bugsCreated > 0) {
    const builder = new Builder({ headless: false, renderOpts: { pretty: true, indent: '  ' } });
    const enrichedXml = builder.buildObject(parsed);
    fs.writeFileSync(JUNIT_REPORT_PATH, enrichedXml, 'utf-8');
    console.log(`\nXML enriched and saved -> ${JUNIT_REPORT_PATH}`);
    console.log(`   ${failuresFound} failure(s) found. ${bugsCreated} Jira bug(s) created and linked.\n`);
  } else if (failuresFound === 0) {
    console.log('\nNo failures found in the XML. No Jira bugs needed.\n');
  } else {
    console.warn('\nFailures found but no Jira bugs were created (check credentials above).\n');
    // Do NOT exit(1) — let TRCLI still upload even if Jira is temporarily down
  }

  console.log('Next step: run TRCLI to upload the enriched XML to TestRail.\n');
}

main().catch(err => {
  console.error('post-bugs-and-enrich-xml failed:', err.message);
  // Exit code 0 intentionally — a Jira outage should NOT block the TestRail upload
  process.exit(0);
});
