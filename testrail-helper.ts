import {test, expect} from '@playwright/test';

export function testRail(caseId: string) {
    test.info().annotations.push({ type: 'test_id', description: caseId });

}

