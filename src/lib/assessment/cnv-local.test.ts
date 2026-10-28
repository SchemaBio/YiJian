import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {cnvInterval,loadCNVReference,clearCNVReferenceCache} from './cnv-reference';
import manifest from './cnv-reference-manifest.json';
import {evaluateRow,selectCandidates} from './engine';
import {referenceGenes} from './reference-client';
import type {AssessmentContext,AssessmentRow} from './types';
const context=():AssessmentContext=>({taskId:'t',attemptId:'a',version:'v',reference:'hg19',hpo:['HP:0001250'],hpoVersion:'h',members:[],availability:[],proofs:{},tables:['cnv-segment'],pack:{reference:'hg19',version:'old-empty',licenses:[],hpo:{},diseases:[],dosage:[],str:[],imprinting:[]},cnvReference:{sha256:'hash',version:'fixture',dosage:[{reference:'hg19',chromosome:'1',start:10,end:20,id:'dosage',gene:'G',hi:3,ts:0,source:'fixture'}]}});
const row=(type='DEL'):AssessmentRow=>({id:'r',table:'cnv-segment',coordinateSystem:'cnr-bed-zero-based-half-open',values:{Chromosome:'chr1',Start:0,End:100,Col4:type,Col6:30}});
afterEach(()=>{vi.unstubAllGlobals();clearCNVReferenceCache();});
it('recomputes CNV 2A from pinned dosage coordinates when the historical snapshot is empty',()=>{
 const c=context(),r=row();r.values.Total_Score=-99;r.values.Classification='Benign';
 const a=evaluateRow(r,c);expect(a.cnvScore).toBe(1);expect(a.cnvClassification).toBe('Pathogenic');expect(a.pinned).toBe(true);expect(a.cnvCriteria?.section2).toMatchObject({hiOverlap:{selected:'2A',score:1}});
 expect(a.cnvCriteria?.section5).toMatchObject({other:{selected:null}});
});
it('matches all overlapping dosage genes to HPO and never adds HPO to CNV points',()=>{
 const c=context();c.supplement={resourceVersion:'ref',version:'s',canonical:{G:'G'},matches:{G:[{gene:'G',diseaseId:'D',score:.8,eligible:true,matched:[{id:'HP:0001250'}],source:'fixture'}]},background:{},warnings:[]};
 expect(referenceGenes([row()],c)).toEqual(['G']);const a=evaluateRow(row(),c);expect(a.phenotypeMatch?.gene).toBe('G');expect(a.phenotypePriority).toBe(true);expect(a.cnvScore).toBe(1);
});
it('does not apply HI as TS, partial overlap, scores 30/40, wrong assembly, or Normal',()=>{
 const c=context();expect(evaluateRow(row('DUP'),c).cnvClassification).toBeUndefined();
 const partial=row();partial.values.Start=11;expect(evaluateRow(partial,c).cnvClassification).toBeUndefined();
 for(const hi of [30,40]){c.cnvReference!.dosage[0].hi=hi;expect(evaluateRow(row(),{...c}).pinned).toBe(false);}
 c.cnvReference!.dosage[0].hi=3;c.reference='hg38';expect(evaluateRow(row(),c).pinned).toBe(false);c.reference='hg19';expect(evaluateRow(row('Normal'),c).pinned).toBe(false);
});
it('does not infer intervals from generic coordinates or permit malformed and empty values',()=>{
 const c=context(),r=row();delete r.coordinateSystem;expect(cnvInterval(r,c)).toBeUndefined();
 for(const start of ['',null,'.',-1,1.5]){const invalid=row();invalid.values.Start=start;expect(cnvInterval(invalid,c)).toBeUndefined();}
 const foreign=row();c.proofs.r={reference:'hg38',interval:{reference:'hg38',chromosome:'1',start:0,end:100}};expect(cnvInterval(foreign,c)).toBeUndefined();
});
it('suppresses auto pins on an explicit quality failure and does not promote HPO-only VUS',()=>{
 const c=context(),r=row();r.values.Col6=0;expect(evaluateRow(r,c).pinned).toBe(false);
 const a=evaluateRow(row('DUP'),c);a.phenotypeScore=.9;selectCandidates([{row:row('DUP'),assessment:a}],c);expect(a.pinned).toBe(false);
});
it.each(['hg19','hg38'] as const)('verifies the immutable %s public reference bytes and hash',async reference=>{
 vi.stubGlobal('crypto',webcrypto);const entry=manifest[reference];const raw=readFileSync('public'+entry.url);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(raw)));
 const c=context();c.reference=reference;const result=await loadCNVReference(c,new AbortController().signal);expect(result.sha256).toBe(entry.sha256);expect(result.dosage.length).toBeGreaterThan(1000);expect(result.dosage.every(d=>d.reference===reference)).toBe(true);
 clearCNVReferenceCache();raw[0]=32;vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(raw)));await expect(loadCNVReference(c,new AbortController().signal)).rejects.toThrow('CNV_REFERENCE_INVALID');
});
