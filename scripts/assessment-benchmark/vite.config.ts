import {defineConfig} from 'vitest/config';
import {resolve,sep} from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const optimized=process.env.ASSESSMENT_BENCH_OPTIMIZED==='true';
const mode=optimized?'optimized':'baseline';
const headers={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'};
export default defineConfig({
 root:resolve(root,'scripts/assessment-benchmark'),publicDir:false,
 resolve:{alias:{'@':resolve(root,'src')}},
 define:{'process.env':'{}','process.env.NEXT_PUBLIC_ASSESSMENT_OPTIMIZED':JSON.stringify(String(optimized)),__BENCH_OPTIMIZED__:JSON.stringify(optimized),__BENCH_COMMIT__:JSON.stringify(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim())},
 build:{outDir:resolve(root,'.assessment-benchmark',mode),emptyOutDir:true,target:'esnext'},
 preview:{host:'127.0.0.1',port:optimized?4124:4123,strictPort:true,headers},
 plugins:[{name:'synthetic-fixture-server',configurePreviewServer(server){server.middlewares.use(async(req,res,next)=>{
  try{
   for(const [name,value] of Object.entries(headers))res.setHeader(name,value);
   const path=new URL(req.url??'/','http://localhost').pathname;
   if(path==='/__benchmark/report'){
    if(req.method!=='POST'||req.headers.origin!==`http://${req.headers.host}`||req.headers['content-type']!=='application/json'){res.statusCode=403;res.end();return;}
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2000000)throw new Error('Report too large');}
    const report=JSON.parse(raw);if(report.kind!=='yijian-synthetic-browser-v1'||report.metadata?.optimized!==optimized)throw new Error('Invalid synthetic report');
    const folder=resolve(root,'.assessment-benchmark/reports');await mkdir(folder,{recursive:true});await writeFile(resolve(folder,`${mode}-${String(report.runs?.[0]?.scenario??'normal').replace(/[^a-z_]/g,'')}.json`),raw);res.end('Saved');return;
   }
   const scenario=String(req.headers['x-benchmark-scenario']??'normal');
   const signalDelay=scenario==='weak'?150:20;
   const send=async(file:string,type:string,delay=0)=>{if(delay)await new Promise(r=>setTimeout(r,delay));const data=await readFile(file);res.setHeader('Content-Type',type);res.setHeader('Content-Length',data.length);res.setHeader('Cache-Control','no-store');res.end(data);};
   const task=path.match(/\/v1\/tasks\/synthetic-(10000|50000|100000)\/results\/(.*)$/);
   if(task){
    if(task[2]==='assessment/context')return await send(resolve(root,`.assessment-benchmark/fixtures/${task[1]}/context.json`),'application/json',signalDelay);
    const table=task[2].match(/^tables\/(snv-indel|cnv-segment|cnv-exon|str|mei|mt|upd|roh)\/(browser|adjustments)$/);
    if(table){if(table[2]==='adjustments'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{revision:0,items:[]}}));return;}
     return await send(resolve(root,`.assessment-benchmark/fixtures/${task[1]}/${table[1]}.info.json`),'application/json',signalDelay);}
    res.statusCode=404;res.end('Synthetic fixture route not found');return;
   }
   if(/^\/reference-api\/assessment\/synthetic-(10000|50000|100000)$/.test(path)){
    await new Promise(r=>setTimeout(r,signalDelay));
    if(scenario==='reference_failure'){res.statusCode=503;res.end('Synthetic reference failure');return;}
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)throw new Error('Synthetic request too large');}
    const body=JSON.parse(raw);const genes:string[]=Array.isArray(body.genes)?body.genes.filter((g:unknown)=>typeof g==='string'&&/^G\d{1,2}$/.test(g)).slice(0,512):[];
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({resourceVersion:'synthetic-reference-v1',version:'synthetic-reference-v1',canonical:Object.fromEntries(genes.map(g=>[g,g])),matches:Object.fromEntries(genes.map(g=>[g,[{gene:g,diseaseId:`D${g.slice(1)}`,score:1,eligible:true,matched:[{id:'HP:0001250'}],source:'synthetic'}]])),background:{},warnings:[],geneRanking:[]}));return;
   }
   if(path.startsWith('/fixtures/')||path.startsWith('/duckdb/')||path.startsWith('/assessment-reference/')){
    if(scenario==='reference_failure'&&path.startsWith('/assessment-reference/')){res.statusCode=503;res.end('Synthetic CNV reference failure');return;}
    const base=path.startsWith('/fixtures/')?resolve(root,'.assessment-benchmark/fixtures'):resolve(root,'public');
    const suffix=path.startsWith('/fixtures/')?path.slice('/fixtures/'.length):path.slice(1);
    const file=resolve(base,suffix);if(!file.startsWith(base+sep)){res.statusCode=403;res.end();return;}
    const type=file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream';
    return await send(file,type,path.startsWith('/duckdb/')?0:signalDelay);
   }
   next();
  }catch{res.statusCode=500;res.end('Synthetic benchmark fixture unavailable');}
 });}}],
});
