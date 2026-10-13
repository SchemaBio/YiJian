const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const directory=process.argv[2]||'/app/data';
const chunks=path.join(process.cwd(),'.next/server/chunks');
const entry=fs.readdirSync(chunks).find(name=>name.startsWith('[worker thread]-scripts_phenotype_reference-worker_cjs_')&&name.endsWith('.js'));
assert(entry,'Production worker bundle missing');
const worker=new Worker(path.join(chunks,entry),{workerData:{directory},resourceLimits:{maxOldGenerationSizeMb:48,maxYoungGenerationSizeMb:8}});
const timer=setTimeout(()=>{console.error('Production worker timed out');worker.terminate();process.exitCode=1;},10000);
worker.on('error',error=>{clearTimeout(timer);console.error(error.message);process.exitCode=1;});
worker.on('message',message=>{
 clearTimeout(timer);
 try{assert(!message.error,message.error);assert.equal(message.value.canonical['HGNC:10585'],'SCN1A');assert(message.value.matches.SCN1A.length>0);console.log('Production bundled worker: SQLite, HPO and HGNC verified');}
 catch(error){console.error(error.message);process.exitCode=1;}
 worker.terminate();
});
worker.postMessage({id:1,request:{genes:['HGNC:10585'],hpo:['HP:0001250']}});
