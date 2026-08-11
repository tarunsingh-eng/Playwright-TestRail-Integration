import express from 'express';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = 3000;

// Use built-in JSON parsing
app.use(express.json());

// Idempotency: a simple set to cache processed event IDs
const processedEvents = new Set<string>();

/**
 * Endpoint to receive TestRail webhooks
 */
app.post('/webhooks/testrail', async (req, res) => {
  try {
    const payload = req.body;
    
    // TestRail sends the event type in the body and headers. We want 'result_created'.
    if (payload.event !== 'result_created') {
      return res.status(200).send('Ignored: Not a result_created event.');
    }

    // 1. Idempotency Check: Prevent duplicate Jira tickets on TestRail retries
    const eventId = req.headers['x-testrail-event-id'] as string;
    if (eventId && processedEvents.has(eventId)) {
      console.log(`[Webhook] Ignored duplicate event: ${eventId}`);
      return res.status(200).send('Ignored: Duplicate event.');
    }

    if (eventId) {
      processedEvents.add(eventId);
    }

    const testResult = payload.payload;

    // 2. Filter: Only create a bug if the test failed (status_id === 5)
    if (testResult.status_id === 5) {
      console.log(`[Webhook] Detected failure for Case C${testResult.case_id}. Logging to Jira...`);
      
      const jiraHost = process.env.JIRA_HOST;
      const jiraEmail = process.env.JIRA_EMAIL;
      const jiraToken = process.env.JIRA_API_TOKEN;
      const jiraProjectKey = process.env.JIRA_PROJECT_KEY;

      if (!jiraHost || !jiraEmail || !jiraToken || !jiraProjectKey) {
        console.error('[Error] Missing Jira environment variables!');
        return res.status(500).send('Missing Jira Config');
      }

      const authHeader = `Basic ${Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64')}`;

      // 3. Build the Jira Issue payload
      const jiraPayload = {
        fields: {
          project: {
            key: jiraProjectKey
          },
          summary: `Automated Test Failed: ${testResult.test_name || `Case C${testResult.case_id}`}`,
          description: `An automated test execution failed.\n\n*Run:* ${testResult.run_name}\n*Case:* C${testResult.case_id}\n*TestRail Result:* ${process.env.TESTRAIL_HOST}/index.php?/tests/view/${testResult.result_id}`,
          issuetype: {
            name: "Bug"
          }
        }
      };

      // 4. Send the POST request to Jira REST API
      const jiraResponse = await fetch(`${jiraHost}/rest/api/2/issue`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jiraPayload)
      });

      if (!jiraResponse.ok) {
        const errorData = await jiraResponse.text();
        console.error(`[Jira Error] Failed to create bug:`, errorData);
        return res.status(500).send('Failed to create Jira Bug');
      }

      const jiraData = await jiraResponse.json();
      console.log(`[Success] Jira Bug Created: ${jiraData.key} (${jiraHost}/browse/${jiraData.key})`);
    } else {
      console.log(`[Webhook] Ignored Case C${testResult.case_id} (Status was not Failed).`);
    }

    // Always respond with 200 OK immediately so TestRail knows we got it
    res.status(200).send('Processed');

  } catch (error) {
    console.error(`[Webhook Error]:`, error);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`TestRail Webhook Receiver running at http://localhost:${port}`);
  console.log(`Ready to receive webhooks at /webhooks/testrail`);
});
