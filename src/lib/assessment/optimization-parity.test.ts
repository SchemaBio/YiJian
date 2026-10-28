import {afterEach,expect,it,vi} from 'vitest';
import {evaluateRow,selectCandidates} from './engine';
import {referenceGenes} from './reference-client';
import type {AssessmentContext,AssessmentRow,ResultTable} from './types';

afterEach(()=>vi.unstubAllEnvs());
function fixture(size:number){
 const ctx:AssessmentContext={taskId:'synthetic',attemptId:'one',version:'fixed',reference:'hg19',hpo:['HP:1','HP:2','HP:1'],hpoVersion:'fixed',members:[],availability:[],proofs:{},pack:{version:'fixed',reference:'hg19',licenses:[],hpo:{'HP:1':{id:'HP:1',ic:4,ancestors:['HP:0']},'HP:2':{id:'HP:2',ic:3,ancestors:['HP:0']},'HP:0':{id:'HP:0',ic:0,ancestors:[]}},diseases:[],dosage:[],str:[],imprinting:[]}};
 for(let i=0;i<80;i++){
  const interval={reference:'hg19',chromosome:i%2?'1':'2',start:i*100,end:i*100+50};
  ctx.pack.dosage.push({...interval,id:'d'+i,gene:'G'+i,hi:i%3===0?3:0,ts:i%3===1?3:0,source:'synthetic'});
  ctx.pack.str.push({...interval,id:'s'+i,gene:'G'+i,motif:i%3===0?undefined:i%3===1?'':'CAG',pathogenicMin:40,source:'synthetic'});
  ctx.pack.imprinting.push({...interval,id:'i'+i,gene:'G'+i,source:'synthetic'});
  ctx.pack.diseases.push({id:'D'+i,gene:'G'+i,hpo:['HP:1'],validity:'Strong',inheritance:'AR'});
 }
 const tables:ResultTable[]=['snv-indel','cnv-segment','cnv-exon','str','mei','mt','upd','roh'];
 const rows=Array.from({length:size},(_,i):AssessmentRow=>{
  const n=i%80,id=String(i),table=tables[i%tables.length];
  const interval={reference:'hg19',chromosome:n%2?'1':'2',start:n*100-(i%3),end:n*100+50+(i%5)};
  ctx.proofs[id]={reference:'hg19',interval,qualityPassed:true,proband:{gt:'1/1',dp:30,gq:40,ad:[0,30]}};
  return {id,table,values:{__validatedInterval:interval,Gene:'G'+n,Type:table==='snv-indel'?'SNP':i%3?'DEL':'DUP',Transcript:'T',Consequence:'missense_variant',AlphaMissense_AM:.99,Filter:'PASS',Repeat_Unit:i%3?'CAG':'',Allele1_Repeats:45}};
 });
 return {ctx,rows};
}

// Large acceptance runs are explicit so ordinary edit/test cycles stay bounded.
const sizes=process.env.ASSESSMENT_LARGE_PARITY==='true'?[1000,10000,50000,100000]:[1000,10000];
it.each(sizes)('preserves every result and reference gene for %i mixed rows',size=>{
 const {ctx,rows}=fixture(size);
 vi.stubEnv('NEXT_PUBLIC_ASSESSMENT_OPTIMIZED','false');
 // Use one immutable context per worker in both paths, including candidate selection.
 const oldContext=structuredClone(ctx);const baseline=rows.map(row=>({row,assessment:evaluateRow(row,oldContext)}));
 selectCandidates(baseline,oldContext);const genes=referenceGenes(rows,oldContext);
 vi.stubEnv('NEXT_PUBLIC_ASSESSMENT_OPTIMIZED','true');
 const nextContext=structuredClone(ctx);const next=rows.map(row=>({row,assessment:evaluateRow(row,nextContext)}));
 selectCandidates(next,nextContext);
 expect(next).toEqual(baseline);expect(referenceGenes(rows,nextContext)).toEqual(genes);
},180000);
