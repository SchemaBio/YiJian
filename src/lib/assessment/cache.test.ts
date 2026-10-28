import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { assessmentCacheKey, setAssessmentCacheScope, readAssessmentCache, writeAssessmentCache, removeAssessmentCache } from './cache';
import type { AssessmentContext } from './types';
afterEach(() => { setAssessmentCacheScope('anonymous'); vi.unstubAllGlobals(); });
it('optimized keys use pinned CNV digest and retain proof invalidation',async()=>{
 vi.stubEnv('NEXT_PUBLIC_ASSESSMENT_OPTIMIZED','true');vi.stubGlobal('crypto',webcrypto);
 try {
  setAssessmentCacheScope('u:o');
  const ctx={taskId:'t',attemptId:'a',reference:'hg19',tables:['cnv-segment'],hpo:[],pack:{version:'v'},proofs:{}} as unknown as AssessmentContext;
  const key=await assessmentCacheKey(ctx);
  expect(await assessmentCacheKey({...ctx,cnvReference:{sha256:'loaded',version:'v',dosage:[]}})).toBe(key);
  expect(await assessmentCacheKey({...ctx,proofs:{r:{reference:'hg19',qualityPassed:true}}})).not.toBe(key);
  expect(await assessmentCacheKey({...ctx,reference:'hg38'})).not.toBe(key);
 }finally{vi.unstubAllEnvs();}
});
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

it('canonicalizes HPO sets, member order and JSON object key order',async()=>{
 vi.stubGlobal('crypto',webcrypto);
 const one={taskId:'task',attemptId:'one',hpo:['HP:2','HP:1'],members:[{id:'b',role:'father'},{id:'a',role:'proband'}],proofs:{one:{reference:'hg19',qualityPassed:true}},pack:{version:'rules'}} as unknown as AssessmentContext;
 setAssessmentCacheScope('user:org');
 const key=await assessmentCacheKey(one);
 expect(await assessmentCacheKey({...one,hpo:['HP:1','HP:2','HP:1'],members:[...one.members].reverse(),proofs:{one:{qualityPassed:true,reference:'hg19'}}})).toBe(key);
});
it('reuses completed results when IndexedDB is unavailable, isolates organizations and purges on logout',async()=>{
 vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('indexedDB',undefined);
 const ctx={taskId:'task',attemptId:'a',hpo:[],pack:{version:'v'}} as unknown as AssessmentContext;
 setAssessmentCacheScope('user:org1');const key=await assessmentCacheKey(ctx);
 expect(key).not.toBeNull();await writeAssessmentCache(key,[]);
 setAssessmentCacheScope('user:org2');expect(await readAssessmentCache(await assessmentCacheKey(ctx))).toBeNull();
 setAssessmentCacheScope('user:org1');expect(await readAssessmentCache(key)).toEqual([]);
 await removeAssessmentCache('another');expect(await readAssessmentCache(key)).toEqual([]);
 setAssessmentCacheScope('anonymous');expect(await readAssessmentCache(key)).toBeNull();
});
it('expires the memory fallback and removes results for explicit reassessment',async()=>{
 vi.stubGlobal('indexedDB',undefined);vi.useFakeTimers();
 try{await writeAssessmentCache('scope/task/a',[]);await removeAssessmentCache('task');expect(await readAssessmentCache('scope/task/a')).toBeNull();
 await writeAssessmentCache('scope/task/a',[]);vi.advanceTimersByTime(24*60*60*1000+1);expect(await readAssessmentCache('scope/task/a')).toBeNull();}finally{vi.useRealTimers();}
});
