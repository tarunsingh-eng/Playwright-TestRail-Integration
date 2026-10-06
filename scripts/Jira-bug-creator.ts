import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { parseStringPromise } from 'xml2js';
import axios from 'axios';
import FormData from 'form-data';

// Configuration
export const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
export const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

const JUNIT_REPORT_PATH = path.join(
  __dirname,
  '..',
  'test-results',
  'results.xml'
);

const SCREENSHOTS_DIR = path.join(
  __dirname,
  '..',
  'test-results'
);

// Validate configuration
if (!JIRA_BASE_URL) {
  throw new Error('Missing JIRA_BASE_URL in .env');
}

if (!JIRA_EMAIL) {
  throw new Error('Missing JIRA_EMAIL in .env');
}

if (!JIRA_API_TOKEN) {
  throw new Error('Missing JIRA_API_TOKEN in .env');
}

if (!JIRA_PROJECT_KEY) {
  throw new Error('Missing JIRA_PROJECT_KEY in .env');
}

console.log('JIRA_BASE_URL:', JIRA_BASE_URL);
console.log('JIRA_EMAIL:', JIRA_EMAIL);
console.log('JIRA_PROJECT_KEY:', JIRA_PROJECT_KEY);

const authHeader = `Basic ${Buffer.from(
  `${JIRA_EMAIL}:${JIRA_API_TOKEN}`
).toString('base64')}`;

// --------------------------------------------------
// Process JUnit failures
// --------------------------------------------------

async function processTestFailures() {
  console.log(`Reading JUnit report from: ${JUNIT_REPORT_PATH}`);

  if (!fs.existsSync(JUNIT_REPORT_PATH)) {
    console.error('JUnit report not found.');
    return;
  }

  const xmlData = fs.readFileSync(JUNIT_REPORT_PATH, 'utf-8');
  const parsed = await parseStringPromise(xmlData);

  const testSuites =
    parsed.testsuites?.testsuite ||
    parsed.testsuite ||
    [];

  for (const suite of testSuites) {
    if (!suite?.testcase) {
      continue;
    }

    for (const testcase of suite.testcase) {
      if (!testcase.failure) {
        continue;
      }

      const testName = testcase.$.name;

      const failureMessage =
        testcase.failure[0]?._ ||
        testcase.failure[0]?.$.message ||
        'Unknown test failure';

      console.log(`\nFailed Test Found: ${testName}`);

      const issueKey = await createJiraBug(
        testName,
        failureMessage
      );

      if (issueKey) {
        console.log(`Created Jira Bug: ${issueKey}`);

        await attachScreenshotsToJira(
          issueKey,
          testName
        );
      }
    }
  }
}

// --------------------------------------------------
// Create Jira Bug
// --------------------------------------------------

export async function createJiraBug(
  testName: string,
  errorTrace: string
): Promise<string | null> {
  const payload = {
    fields: {
      project: {
        key: JIRA_PROJECT_KEY,
      },

      summary: `Automated Test Failure: ${testName}`,

      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `The automated test "${testName}" has failed.`,
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Error Trace:',
              },
            ],
          },
          {
            type: 'codeBlock',
            attrs: {
              language: 'text',
            },
            content: [
              {
                type: 'text',
                text: errorTrace,
              },
            ],
          },
        ],
      },

      issuetype: {
        name: 'Bug',
      },
    },
  };

  try {
    const response = await axios.post(
      `${JIRA_BASE_URL}/rest/api/3/issue`,
      payload,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    return response.data.key;
  } catch (error: any) {
    console.error('\nFailed to create Jira ticket:');

    if (error.response) {
      console.error(`HTTP Status: ${error.response.status}`);

      console.error(
        'Jira Response:',
        JSON.stringify(
          error.response.data,
          null,
          2
        )
      );
    } else {
      console.error(error.message);
    }

    return null;
  }
}

// --------------------------------------------------
// Find screenshots recursively
// --------------------------------------------------

function findScreenshots(
  directory: string,
  testName: string
): string[] {
  const screenshots: string[] = [];

  if (!fs.existsSync(directory)) {
    return screenshots;
  }

  const entries = fs.readdirSync(directory, {
    withFileTypes: true,
  });

  const normalizedTestName = testName
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      const normalizedFolderName = entry.name
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase();

      if (
        normalizedFolderName.includes(
          normalizedTestName
        ) ||
        normalizedTestName.includes(
          normalizedFolderName
        )
      ) {
        const files = fs.readdirSync(fullPath);

        for (const file of files) {
          if (
            file.toLowerCase().endsWith('.png')
          ) {
            screenshots.push(
              path.join(fullPath, file)
            );
          }
        }
      }

      screenshots.push(
        ...findScreenshots(
          fullPath,
          testName
        )
      );
    }
  }

  return screenshots;
}

// --------------------------------------------------
// Attach screenshots to Jira
// --------------------------------------------------

export async function attachScreenshotsToJira(
  issueKey: string,
  testName: string
) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    console.log(
      `Screenshot directory not found: ${SCREENSHOTS_DIR}`
    );
    return;
  }

  const screenshots = findScreenshots(
    SCREENSHOTS_DIR,
    testName
  );

  if (screenshots.length === 0) {
    console.log(
      `No screenshots found for: ${testName}`
    );
    return;
  }

  for (const filePath of screenshots) {
    const fileName = path.basename(filePath);

    const formData = new FormData();

    formData.append(
      'file',
      fs.createReadStream(filePath)
    );

    try {
      console.log(
        `Attaching ${fileName} to ${issueKey}...`
      );

      await axios.post(
        `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/attachments`,
        formData,
        {
          headers: {
            Authorization: authHeader,
            'X-Atlassian-Token': 'no-check',
            ...formData.getHeaders(),
          },
        }
      );

      console.log(
        `Successfully attached ${fileName}`
      );
    } catch (error: any) {
      console.error(
        `Failed to attach ${fileName}:`
      );

      if (error.response) {
        console.error(
          `HTTP Status: ${error.response.status}`
        );

        console.error(
          'Jira Response:',
          JSON.stringify(
            error.response.data,
            null,
            2
          )
        );
      } else {
        console.error(error.message);
      }
    }
  }
}

// --------------------------------------------------
// Connection check — exported so callers can validate
// Jira credentials BEFORE attempting bug creation.
// --------------------------------------------------

export async function testJiraConnection(): Promise<boolean> {
  console.log('\nTesting Jira API connection...');

  try {
    const myself = await axios.get(
      `${JIRA_BASE_URL}/rest/api/3/myself`,
      { headers: { Authorization: authHeader, Accept: 'application/json' } }
    );
    console.log('API authenticated successfully.');
    console.log('User:', myself.data.displayName);
    console.log('Email:', myself.data.emailAddress);
  } catch (error: any) {
    console.error('\nJira authentication failed.');
    console.error('HTTP Status:', error.response?.status);
    console.error('Jira Response:', JSON.stringify(error.response?.data, null, 2));
    return false;
  }

  try {
    const project = await axios.get(
      `${JIRA_BASE_URL}/rest/api/3/project/${JIRA_PROJECT_KEY}`,
      { headers: { Authorization: authHeader, Accept: 'application/json' } }
    );
    console.log('\nJira project found successfully.');
    console.log('Project ID:', project.data.id);
    console.log('Project Key:', project.data.key);
    console.log('Project Name:', project.data.name);
    return true;
  } catch (error: any) {
    console.error('\nCannot access Jira project.');
    console.error('HTTP Status:', error.response?.status);
    console.error('Jira Response:', JSON.stringify(error.response?.data, null, 2));
    return false;
  }
}

// --------------------------------------------------
// NOTE: This file is a shared library.
// It intentionally does NOT call main() here so that
// importing it from post-bugs-and-enrich-xml.ts does
// NOT trigger a second round of bug creation.
// To run this standalone, use: npx tsx Jira-bug-creator.ts --standalone
// --------------------------------------------------

if (process.argv.includes('--standalone')) {
  (async () => {
    const xmlData = fs.readFileSync(JUNIT_REPORT_PATH, 'utf-8');
    const parsed = await parseStringPromise(xmlData);
    const testSuites = parsed.testsuites?.testsuite || parsed.testsuite || [];

    for (const suite of testSuites) {
      if (!suite?.testcase) continue;
      for (const testcase of suite.testcase) {
        if (!testcase.failure) continue;
        const testName = testcase.$.name;
        const failureMessage = testcase.failure[0]?._ || testcase.failure[0]?.$.message || 'Unknown test failure';
        console.log(`\nFailed Test Found: ${testName}`);
        const issueKey = await createJiraBug(testName, failureMessage);
        if (issueKey) {
          console.log(`Created Jira Bug: ${issueKey}`);
          await attachScreenshotsToJira(issueKey, testName);
        }
      }
    }
  })().catch((error) => {
    console.error('Unexpected error:', error);
  });
}