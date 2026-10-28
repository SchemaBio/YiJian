import {queryBrowserParquet,clearBrowserResults} from '@/lib/parquet-browser';
import {assessTask,assessmentStatus,cancelAssessment,setAssessmentCacheScope,type AssessmentStatus} from '@/lib/assessment/client';
import {removeAssessmentCache} from '@/lib/assessment/cache';
import {clearCNVReferenceCache} from '@/lib/assessment/cnv-reference';
import type {AssessmentPreview} from '@/lib/assessment/types';

declare const __BENCH_OPTIMIZED__:boolean;
declare const __BENCH_COMMIT__:string;
type Scenario='normal'|'weak'|'reference_failure'|'cancel';
interface Measurement {
 size:number;cache:'cold'|'hot';scenario:Scenario;repeat:number;state:string;
 firstReadableMs:number|null;firstPreviewEventMs:number|null;fullMs:number;
 mainRealmReportedHeapPeakBytes:number|null;memorySamples:number;
 resultDigest:string|null;pageDigest:string|null;rows:number;previewWithdrawn:boolean;
 requests:Record<string,number>;parquetTimings:unknown;assessmentTimings:unknown;error?:string;
}
interface Report {kind:string;metadata:Record<string,unknown>;runs:Measurement[];summary:unknown[];completed:boolean;error?:string}
const byID=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const status=byID('status'),preview=byID('preview'),output=byID('report');
const sizeControl=byID<HTMLSelectElement>('size'),scenarioControl=byID<HTMLSelectElement>('scenario'),repeatControl=byID<HTMLInputElement>('repeats');
let scenario:Scenario='normal',running=false,stop=false,currentTask='';
let requestCounts:Record<string,number>={};
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const request=new Request(input,init);const url=new URL(request.url);
 if(url.origin!==location.origin)throw new Error('External requests are forbidden in the isolated benchmark');
 const measured=url.pathname.includes('/results/')||url.pathname.startsWith('/reference-api/')||url.pathname.startsWith('/assessment-reference/')||url.pathname.startsWith('/fixtures/');
 if(!measured)return nativeFetch(request);
 const category=url.pathname.includes('/assessment/context')?'context':url.pathname.startsWith('/reference-api/')?'gene_reference':url.pathname.startsWith('/assessment-reference/')?'cnv_reference':url.pathname.endsWith('.parquet')?'parquet':url.pathname.endsWith('/browser')?'dataset_authorization':'other_fixture';
 requestCounts[category]=(requestCounts[category]??0)+1;
 const headers=new Headers(request.headers);headers.set('X-Benchmark-Scenario',scenario);
 return nativeFetch(new Request(request,{headers}));
};
const metadata={commit:__BENCH_COMMIT__,optimized:__BENCH_OPTIMIZED__,userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,
 deviceMemoryGiB:(navigator as Navigator&{deviceMemory?:number}).deviceMemory??null,crossOriginIsolated,visibilityState:document.visibilityState,
 memoryScope:'performance.memory reports implementation-dependent main-realm heap, not a proven whole-page/worker peak; the 110% memory acceptance gate remains unverified',
 coldDefinition:'completed assessment and parsed CNV reference caches cleared; fresh DuckDB/assessment workers; compiled assets and OS/browser HTTP caches may be warm',
 hotDefinition:'same immutable task/context, completed assessment cache retained; fresh DuckDB worker and reauthorized context',
 referenceFailure:'both CNV and gene reference fixture endpoints return 503; degraded results must not become a complete cache entry',
 weakDefinition:'150 ms synthetic fixture endpoint latency, not a bandwidth or packet-loss simulation',
 fixtureVersion:'synthetic-browser-benchmark-v1',source:'real BrowserTable/Arrow stream/assessment worker; synthetic immutable API/object/reference inputs'};
byID('environment').textContent=JSON.stringify(metadata);
const renderPreview=(rows:AssessmentPreview[]|undefined)=>{
 preview.replaceChildren();for(const row of rows??[]){const li=document.createElement('li');li.textContent=`${row.table} ${row.gene??''}: ${row.classification??'insufficient_evidence'}; score ${row.score}; ${row.criteria.map(x=>x.code).join(', ')}; ${row.pending.join('; ')}`;preview.append(li);}
};
async function sha(value:unknown){const bytes=new TextEncoder().encode(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?{$bigint:item.toString()}:item));const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function quantile(values:number[],q:number){const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*q)-1)]??null;}
function summarize(runs:Measurement[]){const groups=new Map<string,Measurement[]>();for(const run of runs){const key=`${run.size}/${run.cache}/${run.scenario}`;const group=groups.get(key)??[];group.push(run);groups.set(key,group);}
 return [...groups].map(([group,runs])=>({group,n:runs.length,states:[...new Set(runs.map(r=>r.state))],firstReadableP50:quantile(runs.flatMap(r=>r.firstReadableMs===null?[]:[r.firstReadableMs]),.5),firstReadableP95:quantile(runs.flatMap(r=>r.firstReadableMs===null?[]:[r.firstReadableMs]),.95),fullP50:quantile(runs.map(r=>r.fullMs),.5),fullP95:quantile(runs.map(r=>r.fullMs),.95),heapCounterMax:Math.max(...runs.map(r=>r.mainRealmReportedHeapPeakBytes??0)),resultDigests:[...new Set(runs.map(r=>r.resultDigest))],pageDigests:[...new Set(runs.map(r=>r.pageDigest))],allPreviewsWithdrawn:runs.every(r=>r.previewWithdrawn)}));
}
async function measure(size:number,cache:'cold'|'hot',repeat:number):Promise<Measurement>{
 await clearBrowserResults();
 if(cache==='cold'){await removeAssessmentCache();clearCNVReferenceCache();}
 setAssessmentCacheScope('synthetic-user:synthetic-organization');
 requestCounts={};currentTask=`synthetic-${size}`;renderPreview(undefined);byID('final').replaceChildren();
 let firstReadable:number|null=null,firstPreview:number|null=null,peak:number|null=null,samples=0,parquetTimings:unknown=null,assessmentTimings:unknown=null;
 const sample=()=>{const memory=(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory;if(memory){samples++;peak=Math.max(peak??0,memory.usedJSHeapSize);}};
 const started=performance.now();const timer=setInterval(sample,50);sample();
 const changed=(event:Event)=>{
  const detail=(event as CustomEvent<AssessmentStatus>).detail;if(detail.taskId!==currentTask)return;
  renderPreview(detail.preview);status.textContent=`${size} ${cache} ${scenario} #${repeat}: ${detail.state}/${detail.phase??''}, ${detail.processed} rows`;
  if(detail.preview?.length){firstPreview??=performance.now()-started;requestAnimationFrame(()=>{if(preview.children.length)firstReadable??=performance.now()-started;});}
  if(scenario==='cancel'&&detail.state==='loading'&&detail.processed>=1000)cancelAssessment(currentTask);
 };
 const loaded=(event:Event)=>{parquetTimings=(event as CustomEvent).detail.timings;};
 const timed=(event:Event)=>{assessmentTimings=(event as CustomEvent).detail;};
 window.addEventListener('yijian:assessment-status',changed);window.addEventListener('yijian:result-load-timing',loaded);window.addEventListener('yijian:assessment-timing',timed);
 try{
  const page=await queryBrowserParquet(currentTask,'snv-indel',{offset:0,limit:50});
  for(const item of page.items){const li=document.createElement('li');li.textContent=`${String(item.Gene??'')}: ${String(item.acmgClassification??item.cnvClassification??'unclassified')}; pinned ${String(item.pinned??false)}`;byID('final').append(li);}
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  // The baseline has no provisional row surface. Its first readable page follows
  // materialization/query; a ready assessment event alone is not a rendered page.
  if(firstReadable===null)firstReadable=performance.now()-started;
  const full=performance.now()-started;sample();clearInterval(timer);
  const state=assessmentStatus(currentTask)?.state??'missing';
  const entries=await assessTask(currentTask,async()=>{throw new Error('Unexpected second assessment read');},new AbortController().signal);
  if(scenario!=='cancel'&&entries.length!==size)throw new Error('Full row count mismatch');
  if(scenario==='cancel'&&(state!=='cancelled'||entries.length!==0))throw new Error('Cancellation published incomplete automatic results');
  const result:Measurement={size,cache,scenario,repeat,state,firstReadableMs:firstReadable,firstPreviewEventMs:firstPreview,fullMs:full,mainRealmReportedHeapPeakBytes:peak,memorySamples:samples,resultDigest:await sha(entries),pageDigest:await sha(page.items),rows:entries.length,previewWithdrawn:!assessmentStatus(currentTask)?.preview?.length&&preview.children.length===0,requests:{...requestCounts},parquetTimings,assessmentTimings};
  if(cache==='hot'&&scenario==='normal'&&(result.requests.gene_reference??0)>1)throw new Error('Hot assessment cache was not reused');
  if(cache==='hot'&&scenario==='reference_failure'&&(result.requests.cnv_reference??0)===0)throw new Error('Degraded assessment was cached as complete');
  return result;
 }catch(error){sample();throw error;}finally{clearInterval(timer);window.removeEventListener('yijian:assessment-status',changed);window.removeEventListener('yijian:result-load-timing',loaded);window.removeEventListener('yijian:assessment-timing',timed);}
}
async function execute(sizes:number[]){
 if(running)return;running=true;stop=false;scenario=scenarioControl.value as Scenario;
 const repeats=Math.max(1,Math.min(20,Number(repeatControl.value)||1));
 const report:Report={kind:'yijian-synthetic-browser-v1',metadata,runs:[],summary:[],completed:false};
 byID<HTMLButtonElement>('run').disabled=true;byID<HTMLButtonElement>('suite').disabled=true;
 try{
  const manifest=await (await nativeFetch('/fixtures/manifest.json')).json();report.metadata={...metadata,fixtureManifest:manifest};
  for(const size of sizes)for(let repeat=1;repeat<=repeats;repeat++)for(const cache of ['cold','hot'] as const){
   if(stop)throw new Error('Benchmark stopped');
   report.runs.push(await measure(size,cache,repeat));report.summary=summarize(report.runs);output.textContent=JSON.stringify(report,null,2);
   const response=await nativeFetch('/__benchmark/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});if(!response.ok)throw new Error('Benchmark report could not be persisted');
  }
  report.completed=true;status.textContent='Completed';
 }catch(error){report.error=error instanceof Error?error.message:'Benchmark failed';status.textContent=`Stopped: ${report.error}`;}
 finally{await clearBrowserResults();renderPreview(undefined);report.summary=summarize(report.runs);output.textContent=JSON.stringify(report,null,2);await nativeFetch('/__benchmark/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)}).catch(()=>undefined);running=false;byID<HTMLButtonElement>('run').disabled=false;byID<HTMLButtonElement>('suite').disabled=false;}
}
byID('run').addEventListener('click',()=>void execute([Number(sizeControl.value)]));
byID('suite').addEventListener('click',()=>void execute([10000,50000,100000]));
byID('stop').addEventListener('click',()=>{stop=true;if(currentTask)cancelAssessment(currentTask);});
