import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {evaluateRow,selectCandidates} from './engine';
import type {AssessmentContext,ReferencePack} from './types';

it.skipIf(!process.env.ASSESSMENT_TEST_REFERENCE)('measures 55,393 synthetic rows against a pinned public reference pack',()=>{
 const pack=JSON.parse(readFileSync(process.env.ASSESSMENT_TEST_REFERENCE!,'utf8')) as ReferencePack;
 const disease=pack.diseases.find(d=>d.hpo.length>=2)!;
 expect(disease).toBeDefined();
 const ctx:AssessmentContext={taskId:'performance-fixture',attemptId:'fixture',version:'fixed',reference:pack.reference,hpo:disease.hpo.slice(0,2),hpoVersion:pack.version,pack,proofs:{},members:[],availability:[]};
 const genotype={gt:'1/1',dp:30,gq:40,ad:[0,30]};
 const frequency=[{population:'global',af:0,an:10000,pass:true},{population:'eas',af:0,an:1000,pass:true}];
 const baseline=process.memoryUsage().heapUsed,start=performance.now();
 const records=Array.from({length:55393},(_,i)=>{
  const id=String(i).padStart(6,'0');ctx.proofs[id]={reference:pack.reference,proband:genotype,frequency};
  const row={id,table:'snv-indel' as const,values:{Gene:disease.gene,Filter:'PASS',Type:'SNP',Transcript:'FIXTURE',Consequence:'missense_variant',AlphaMissense_AM:.9}};
  return {row,assessment:evaluateRow(row,ctx)};
 });
 const evaluated=performance.now();selectCandidates(records,ctx);
 console.info(JSON.stringify({fixture:'synthetic-55393',referenceVersion:pack.version,evaluationMilliseconds:Math.round(evaluated-start),candidateMilliseconds:Math.round(performance.now()-evaluated),heapDeltaMiB:Math.round((process.memoryUsage().heapUsed-baseline)/1048576)}));
 expect(records).toHaveLength(55393);expect(records.filter(x=>x.assessment.pinned).length).toBeLessThanOrEqual(100);
},30000);
