import { test } from '@playwright/test';

export function testRail(caseId: string): void {
    test.info().annotations.push({ type: 'test_id', description: caseId });
}
