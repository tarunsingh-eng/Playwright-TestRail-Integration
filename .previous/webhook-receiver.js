const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

const WEBHOOK_SECRET = process.env.TESTRAIL_WEBHOOK_SECRET;

const processedEvents = new Set();

if (!WEBHOOK_SECRET) {
  console.error('ERROR: TESTRAIL_WEBHOOK_SECRET is not configured.');
  process.exit(1);
}


// Verify TestRail webhook authorization
function verifySignature(req, res, next) {
  const authorization = req.headers['authorization'];

  console.log('\n[Webhook Request]');
  console.log('Authorization received:', authorization ? 'YES' : 'NO');

  if (!authorization) {
    return res.status(401).json({
      error: 'Missing Authorization header'
    });
  }

  if (authorization !== WEBHOOK_SECRET) {
    return res.status(403).json({
      error: 'Invalid webhook secret'
    });
  }

  next();
}


// Receive TestRail webhook
app.post('/webhooks/testrail', verifySignature, (req, res) => {

  console.log('\n==============================');
  console.log('TestRail Webhook Received');
  console.log('==============================');

  console.log('Headers:');
  console.log(req.headers);

  console.log('\nPayload:');
  console.log(JSON.stringify(req.body, null, 2));

  const {
    event,
    event_id,
    payload
  } = req.body;


  // TestRail's "Test" button can send event_id as null
  if (event_id !== null && event_id !== undefined) {

    if (processedEvents.has(event_id)) {

      console.log(
        `[Idempotency] Duplicate event ${event_id} ignored.`
      );

      return res.status(200).json({
        status: 'ignored',
        reason: 'duplicate',
        event_id
      });
    }

    processedEvents.add(event_id);
  }


  console.log(`\nEvent Type: ${event}`);
  console.log(`Event ID: ${event_id}`);


  // Handle TestRail test request
  if (event === 'test') {

    console.log('TestRail webhook test received successfully.');

    return res.status(200).json({
      status: 'success',
      message: 'TestRail webhook connection is working'
    });
  }


  // Handle result created event
  if (event === 'test_result_created') {

    const {
      result_id,
      run_id,
      case_id,
      status_id,
      comment,
      defects
    } = payload || {};

    console.log('\nTest Result Created');
    console.log(`Result ID: ${result_id}`);
    console.log(`Run ID: ${run_id}`);
    console.log(`Case ID: C${case_id}`);
    console.log(`Status ID: ${status_id}`);
    console.log(`Comment: ${comment || 'None'}`);
    console.log(`Defects: ${defects || 'None'}`);
  }


  // Handle any other TestRail event
  console.log(`\nWebhook event processed: ${event}`);


  return res.status(200).json({
    status: 'success',
    event,
    event_id
  });
});


// Health check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'TestRail Webhook Receiver is running'
  });
});


app.listen(PORT, () => {
  console.log('====================================');
  console.log('TestRail Webhook Receiver');
  console.log('====================================');
  console.log(`Running on port ${PORT}`);
  console.log(`Webhook URL: /webhooks/testrail`);
  console.log('Waiting for TestRail events...');
});