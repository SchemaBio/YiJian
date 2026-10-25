const {test}=require('node:test'),assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads'),{DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
test('indexed matching, aliases, broad/obsolete terms and pinned versions',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'hpo-reference-'));
 const create=(name,sql)=>{const db=new DatabaseSync(path.join(root,name+'.sqlite'));db.exec(sql);return db;};
 const hpo=create('hpo','CREATE TABLE terms(id TEXT PRIMARY KEY,payload TEXT);CREATE TABLE obsolete(id TEXT PRIMARY KEY,replacement TEXT);CREATE TABLE diseases(gene TEXT,id TEXT,name TEXT,hpo TEXT,source TEXT,PRIMARY KEY(gene,id));');
 const insert=hpo.prepare('INSERT INTO terms VALUES(?,?)');insert.run('HP:0000001',JSON.stringify({id:'HP:0000001',ancestors:[],ic:0,name:'Broad'}));insert.run('HP:0000002',JSON.stringify({id:'HP:0000002',ancestors:['HP:0000001'],ic:4,name:'Specific'}));
 hpo.exec("INSERT INTO obsolete VALUES('HP:0000003','HP:0000002');INSERT INTO diseases VALUES('GENE','D','Disease','[\"HP:0000002\"]','fixture');");hpo.close();
 const hgnc=create('hgnc',"CREATE TABLE genes(symbol TEXT PRIMARY KEY);CREATE TABLE aliases(alias TEXT,symbol TEXT);INSERT INTO genes VALUES('GENE');INSERT INTO aliases VALUES('OLD','GENE'),('AMBIGUOUS','GENE'),('AMBIGUOUS','OTHER');");hgnc.close();
 const clingen=create('clingen','CREATE TABLE validity(gene TEXT,disease TEXT,payload TEXT);');clingen.close();
 const files={};for(const name of ['hpo','hgnc','clingen']){const file=name+'.sqlite',raw=fs.readFileSync(path.join(root,file));files[file]={bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')};}
 const digest='a'.repeat(64);fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({schema:1,digest,version:'fixture',files}));
 const worker=new Worker(path.join(__dirname,'reference-worker.cjs'),{workerData:{directory:root}});let id=0;
 const query=request=>new Promise((resolve,reject)=>{const key=++id;const handler=message=>{if(message.id!==key)return;worker.off('message',handler);message.error?reject(Error(message.error)):resolve(message.value);};worker.on('message',handler);worker.once('error',reject);worker.postMessage({id:key,request});});
 try{
  const result=await query({genes:['OLD','AMBIGUOUS'],hpo:['HP:0000002'],resourceVersion:digest});assert.equal(result.canonical.OLD,'GENE');assert.equal(result.canonical.AMBIGUOUS,null);assert.equal(result.matches.GENE[0].score,1);assert.equal(result.matches.GENE[0].eligible,true);
  const ranked=await query({genes:[],hpo:['HP:0000002'],rank:true});assert.equal(ranked.geneRanking.length,1);assert.equal(ranked.geneRanking[0].gene,'GENE');assert.equal(ranked.geneRanking[0].score,1);
  const emptyRank=await query({genes:[],hpo:['HP:0000001'],rank:true});assert.deepEqual(emptyRank.geneRanking,[]);
  const broad=await query({genes:['GENE'],hpo:['HP:0000001']});assert.equal(broad.matches.GENE.length,0);
  const obsolete=await query({genes:['GENE'],hpo:['HP:0000003','HP:9999999']});assert.equal(obsolete.matches.GENE[0].eligible,true);assert.equal(obsolete.warnings.length,2);
  await assert.rejects(query({genes:['GENE'],hpo:['HP:0000002'],resourceVersion:'old'}),/REFERENCE_VERSION_CHANGED/);
 }finally{await worker.terminate();fs.rmSync(root,{recursive:true,force:true});}
});
