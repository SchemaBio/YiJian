import {afterEach,it,expect,vi} from 'vitest';
import {loadReferences} from './reference-client';
import type {AssessmentContext} from './types';
const context={taskId:'task',version:'v',referenceVersion:'r'} as AssessmentContext;
afterEach(()=>vi.unstubAllGlobals());
it('loads a genome-wide candidate list without sending patient HPO in the body',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({resourceVersion:'r',version:'fixture',canonical:{},matches:{},background:{},warnings:[],geneRanking:[]})});vi.stubGlobal('fetch',fetcher);
 expect((await loadReferences(context,[],new AbortController().signal,true)).geneRanking).toEqual([]);
 const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.rank).toBe(true);expect(body.genes).toEqual([]);expect(body.hpo).toBeUndefined();
});
it('batches more than 512 genes and follows pages without discarding any gene',async()=>{
 const fetcher=vi.fn().mockImplementation(async(_url:string,request:RequestInit)=>{const body=JSON.parse(request.body as string);return {ok:true,json:async()=>({resourceVersion:'r',version:'fixture',canonical:Object.fromEntries(body.genes.slice(body.cursor??0,body.cursor?undefined:1).map((g:string)=>[g,g])),matches:{},background:{},warnings:[],nextCursor:body.genes.length>1&&!body.cursor?1:undefined})};});vi.stubGlobal('fetch',fetcher);
 const result=await loadReferences(context,Array.from({length:513},(_,i)=>'G'+i),new AbortController().signal);
 expect(fetcher).toHaveBeenCalledTimes(3);expect(Object.keys(result.canonical)).toHaveLength(513);
});
it('rejects a changed public resource instead of mixing versions',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({resourceVersion:'old'})}));await expect(loadReferences(context,['G'],new AbortController().signal)).rejects.toThrow('REFERENCE_VERSION_CHANGED');
});
