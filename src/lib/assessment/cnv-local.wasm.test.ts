// @vitest-environment node
import { prepareAIRequestInput } from '../ai-request-input';
import { aiVariantContext } from '@/app/(main)/tasks/[uuid]/utils/ai-context';
import type { CNVSegment } from '@/app/(main)/tasks/[uuid]/types';
import {beforeAll,afterAll,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,copyFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {DuckDBConnection} from '@duckdb/duckdb-wasm/blocking';
import {buildLocalSelection,literal} from '../parquet-browser-sql';
import {evaluateRow} from './engine';
import type {AssessmentContext,AssessmentRow} from './types';
import manifest from './cnv-reference-manifest.json';
const require=createRequire(import.meta.url);let conn:DuckDBConnection;let db:{reset:()=>void;registerFileBuffer:(name:string,data:Uint8Array)=>void};
beforeAll(async()=>{
 const home=path.resolve('.gotmp/cnv-wasm-test');
 const extensions=path.join(home,'.duckdb/extensions/extensions.duckdb.org/v1.4.3/wasm_mvp');mkdirSync(extensions,{recursive:true});
 for(const name of ['json','parquet'])copyFileSync('public/duckdb/extensions/v1.4.3/wasm_mvp/'+name+'.duckdb_extension.wasm',path.join(extensions,name+'.duckdb_extension.wasm'));
 // The Node bindings hard-code os.homedir() for module downloads. Seed their
 // workspace-local cache with the same signed files used by the browser.
 vi.spyOn(os,'homedir').mockReturnValue(home);
 const bindings=require('@duckdb/duckdb-wasm/blocking');const engine=await bindings.createDuckDB({mvp:{mainModule:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm')}},new bindings.VoidLogger(),bindings.NODE_RUNTIME);
 await engine.instantiate();db=engine;conn=engine.connect();conn.query('LOAD json; LOAD parquet; SET autoinstall_known_extensions=false; SET autoload_known_extensions=false');
},30000);
afterAll(()=>{conn?.close();db?.reset();vi.restoreAllMocks();});
it('sorts effective P/LP scores over the entire dataset before HPO ties and pagination in real WASM',()=>{
 conn.query('CREATE TABLE source(file_row_number INT,__row_id VARCHAR,Start INT)');conn.query('CREATE TABLE automatic(row_id VARCHAR,baseline JSON)');conn.query('CREATE TABLE overlays(row_id VARCHAR,payload JSON)');
 const fixtures=[{classification:'VUS',score:0,hpo:0},{classification:'Likely_Pathogenic',score:.9,hpo:.99},{classification:'Pathogenic',score:1,hpo:.1},{classification:'Pathogenic',score:1,hpo:.9},{classification:'Pathogenic',score:1.2,hpo:0},{classification:'Pathogenic',score:1,hpo:0},{classification:'VUS',score:0,hpo:0}];
 for(const [i,f] of fixtures.entries()){
  conn.query(`INSERT INTO source VALUES(${i},'r${i}',${i})`);conn.query(`INSERT INTO automatic VALUES('r${i}',${literal(JSON.stringify({pinned:i>0&&i<6,classification:f.classification,cnvClassification:f.classification,cnvScore:f.score,phenotypeMatch:{score:f.hpo}}))})`);
 }
 conn.query(`INSERT INTO overlays VALUES('r4','{"pinned":false}'),('r5','{"cnvAssessment":{"classification":"Likely_Pathogenic","totalScore":0.95}}'),('r6','{"focused":true}')`);
 const selection=buildLocalSelection({offset:0,limit:20,sort:'Start'},['Start'],'cnv-segment');
 const query=`SELECT t.file_row_number FROM source t LEFT JOIN automatic a ON a.row_id=t.__row_id LEFT JOIN overlays o ON o.row_id=t.__row_id ORDER BY ${selection.order}`;
 expect(conn.query(query).toArray().map(r=>r.file_row_number)).toEqual([6,3,2,5,1,0,4]);
 expect(conn.query(query+' LIMIT 2 OFFSET 2').toArray().map(r=>r.file_row_number)).toEqual([2,5]);
});
it.skipIf(!process.env.CNV_ACCEPTANCE_FILE)('reads the original current CNV Parquet and locally recomputes dosage evidence without writing results',()=>{
 db.registerFileBuffer('production-cnv.parquet',new Uint8Array(readFileSync(process.env.CNV_ACCEPTANCE_FILE!)));conn.query(`CREATE TABLE production AS SELECT "Chromosome","Start","End","Col4","Col6",file_row_number FROM read_parquet('production-cnv.parquet',file_row_number=true)`);
 const resource=JSON.parse(readFileSync('public'+manifest.hg19.url,'utf8'));
 const context:AssessmentContext={taskId:'read-only-acceptance',attemptId:'current',version:'acceptance',reference:'hg19',hpo:[],hpoVersion:'none',members:[],availability:[],proofs:{},pack:{reference:'hg19',version:'old-empty',licenses:[],hpo:{},diseases:[],dosage:[],str:[],imprinting:[]},cnvReference:{sha256:manifest.hg19.sha256,version:resource.version,dosage:resource.dosage}};
 let count=0,events=0,pinned=0,scored=0;
 for(const record of conn.query('SELECT file_row_number,"Chromosome","Start","End","Col4","Col6" FROM production').toArray()){
  const values=record.toJSON();const row:AssessmentRow={id:String(values.file_row_number),table:'cnv-segment',coordinateSystem:'cnr-bed-zero-based-half-open',values};const result=evaluateRow(row,context);count++;
  if(['DEL','DUP'].includes(String(values.Col4).toUpperCase()))events++;
  if(result.cnvClassification)scored++;
  if(result.pinned){pinned++;expect(['Pathogenic','Likely_Pathogenic']).toContain(result.cnvClassification);expect(String(values.Col4)).not.toBe('Normal');}
 }
 expect(count).toBe(64732);expect(events).toBeGreaterThan(0);expect(scored).toBeGreaterThan(0);expect(pinned).toBeGreaterThan(0);
 console.log('CNV_READ_ONLY_ACCEPTANCE',JSON.stringify({rows:count,events,scored,pinned}));
},30000);

it('serializes the real WASM BIGINT interval-length annotation for CNV AI submission',()=>{
 const values=conn.query('SELECT GREATEST(0,CAST(200 AS BIGINT)-CAST(100 AS BIGINT)) AS Interval_Length').toArray()[0].toJSON();
 expect(typeof values.Interval_Length).toBe('bigint');
 const variant=aiVariantContext({id:'synthetic',chromosome:'1',startPosition:100,endPosition:200,type:'Deletion',copyNumber:0,coordinateSystem:'0-based-half-open',annotationValues:values} as unknown as CNVSegment);
 expect(()=>JSON.stringify(variant)).toThrow();
 const safe=prepareAIRequestInput({feature:'cnv_loss',variant});
 expect(()=>JSON.stringify(safe)).not.toThrow();expect((safe.variant!.annotationValues as Record<string,unknown>).Interval_Length).toBe(100);expect(safe.variant!.copyNumber).toBe(0);
});
