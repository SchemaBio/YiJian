import {it,expect,vi,afterEach} from 'vitest';
import type {AssessmentContext,AutomaticAssessment} from './types';
afterEach(()=>vi.unstubAllGlobals());
it('restores the original baseline if supplementary queries fail halfway through',async()=>{
 vi.resetModules();const postMessage=vi.fn();const scope={postMessage,onmessage:undefined as undefined|((event:MessageEvent)=>void)};vi.stubGlobal('self',scope);await import('./worker');
 let sequence=0;const rpc=(action:string,payload?:unknown)=>{scope.onmessage!({data:{id:++sequence,action,payload}} as MessageEvent);const response=postMessage.mock.calls.at(-1)![0];expect(response.error).toBeUndefined();return response.value;};
 const context:AssessmentContext={taskId:'fixture',attemptId:'a',version:'v',reference:'hg19',referenceVersion:'r',hpo:['HP:0000001'],hpoVersion:'h',members:[],availability:[],proofs:{},pack:{version:'pack',reference:'hg19',licenses:[],hpo:{},diseases:[],dosage:[],str:[],imprinting:[]}};
 rpc('init',context);rpc('references',{resourceVersion:'r',version:'fixture',canonical:{G:'G'},matches:{G:[{gene:'G',diseaseId:'D',score:1,eligible:true,matched:[{id:'HP:0000001'}],source:'fixture'}]},background:{},warnings:[]});
 rpc('batch',[{id:'1',table:'snv-indel',values:{Gene:'G',ClinVar_Sig:'Pathogenic'}}]);rpc('references-unavailable');rpc('finish');
 const result=(rpc('drain') as {assessment:AutomaticAssessment}[])[0].assessment;
 expect(result.classification).toBe('Pathogenic');expect(result.pinned).toBe(false);expect(result.phenotypePriority).toBe(false);expect(result.phenotypeMatch).toBeUndefined();expect(result.criteria).toEqual([]);
});
