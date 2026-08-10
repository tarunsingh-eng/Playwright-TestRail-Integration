import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

class TestReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    const dir = path.resolve('test-results');
    fs.mkdirSync(dir, { recursive: true });

    const safeName = test.title
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();

    const logFile = path.join(dir, `${safeName}.log`);

    let log = '';

    log += `Test: ${test.title}\n`;
    log += `Status: ${result.status}\n`;
    log += `Duration: ${result.duration}ms\n\n`;

    if (result.error) {
      log += `ERROR:\n${result.error.message}\n\n`;
      log += `STACK:\n${result.error.stack ?? ''}\n\n`;
    }

    fs.writeFileSync(logFile, log);

    console.log(`Log created: ${logFile}`);
  }
}

export default TestReporter;