const {Worker}=require('node:worker_threads');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
const directory=process.argv[2];if(!directory)throw Error('Database directory required');
const db=new DatabaseSync(path.join(directory,'hpo.sqlite'),{readOnly:true});
const genes=db.prepare('SELECT DISTINCT gene FROM diseases ORDER BY gene LIMIT 512').all().map(row=>row.gene);db.close();
const io=()=>{try{return fs.readFileSync('/proc/self/io','utf8').split('\n').reduce((r,l)=>{const [k,v]=l.split(':');if(v)r[k]=Number(v.trim());return r;},{});}catch{return {};}};
const before=process.memoryUsage().rss,firstIO=io();
const worker=new Worker(path.join(__dirname,'reference-worker.cjs'),{workerData:{directory},resourceLimits:{maxOldGenerationSizeMb:48,maxYoungGenerationSizeMb:8}});
let id=0;const pending=new Map();worker.on('message',message=>{const call=pending.get(message.id);pending.delete(message.id);if(message.error)call.reject(Error(message.error));else call.resolve(message.value);});worker.on('error',error=>{for(const c of pending.values())c.reject(error);});
const query=hpo=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});worker.postMessage({id:n,request:{genes,hpo}});});
(async()=>{
 const start=performance.now();const cold=await query(['HP:0001250']);const coldMs=performance.now()-start,coldRSS=process.memoryUsage().rss;
 const timings=[];const warmIO=io();
 for(let n=0;n<10;n++){const t=performance.now();await query(['HP:0001250']);timings.push(performance.now()-t);}
 const concurrentStart=performance.now();await Promise.all([query(['HP:0001250']),query(['HP:0004322'])]);
 const finalIO=io();timings.sort((a,b)=>a-b);
 const report={genes:genes.length,resourceVersion:cold.resourceVersion,coldMs:Math.round(coldMs),warmP95Ms:Math.round(timings[Math.ceil(timings.length*.95)-1]),twoTasksMs:Math.round(performance.now()-concurrentStart),coldRSSDeltaMiB:+((coldRSS-before)/1048576).toFixed(1),warmRSSDeltaMiB:+((process.memoryUsage().rss-before)/1048576).toFixed(1),coldReadChars:(warmIO.rchar||0)-(firstIO.rchar||0),warmReadChars:(finalIO.rchar||0)-(warmIO.rchar||0),physicalReadBytes:(finalIO.read_bytes||0)-(firstIO.read_bytes||0)};
 console.log(JSON.stringify(report));await worker.terminate();
 if(report.coldRSSDeltaMiB>128 || report.warmRSSDeltaMiB>64 || report.warmP95Ms>200)process.exitCode=1;
})().catch(async error=>{console.error(error.message);await worker.terminate();process.exitCode=1;});
