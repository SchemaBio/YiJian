import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { assessmentCacheKey, setAssessmentCacheScope } from './cache';
import type { AssessmentContext } from './types';
afterEach(() => { setAssessmentCacheScope('anonymous'); vi.unstubAllGlobals(); });
it('isolates saved assessments by account, organization, attempt, rules, HPO and reference context', async () => {
  vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('indexedDB', {});
  const context = {taskId:'task',attemptId:'one',version:'v1',hpo:['HP:1'],pack:{version:'rules1'},proofs:{}} as unknown as AssessmentContext;
  setAssessmentCacheScope('user1:org1');
  const first = await assessmentCacheKey(context);
  expect(await assessmentCacheKey(context)).toBe(first);
  for (const change of [{attemptId:'two'},{version:'v2'},{hpo:['HP:2']},{pack:{version:'rules2'}},{referenceVersion:'new'}]) expect(await assessmentCacheKey({...context,...change} as AssessmentContext)).not.toBe(first);
  setAssessmentCacheScope('user2:org1'); expect(await assessmentCacheKey(context)).not.toBe(first);
  setAssessmentCacheScope('user1:org2'); expect(await assessmentCacheKey(context)).not.toBe(first);
  setAssessmentCacheScope('anonymous'); expect(await assessmentCacheKey(context)).toBeNull();
});
