// @vitest-environment node
import {beforeAll,afterAll,expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {readSNVSample,sampleVafSQL,sampleRoleSQL} from './snv-sample-metrics';
import {ident,literal,buildLocalSelection} from './parquet-browser-sql';
import type { DuckDBConnection } from '@duckdb/duckdb-wasm/blocking';
const require=createRequire(import.meta.url);
let connection: DuckDBConnection;
let db: {reset:()=>void;registerFileBuffer:(name:string,data:Uint8Array)=>void};
beforeAll(async()=>{
  const bindings=require('@duckdb/duckdb-wasm/blocking');
  const engine=await bindings.createDuckDB({mvp:{mainModule:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm')}},new bindings.VoidLogger(),bindings.NODE_RUNTIME);
  await engine.instantiate();db=engine;connection=engine.connect();
},30000);
afterAll(()=>{connection?.close();db?.reset();});
it('matches displayed sample values in real DuckDB WASM, including missing and ambiguous data',()=>{
  const fixtures=[{VAF:'.',AD:'60,46',Alt:'G'},{VAF:'0',AD:'60,46',Alt:'G'},{VAF:'1',AD:'.',Alt:'G'},{VAF:'.',AD:'0,0',Alt:'G'},{VAF:'.',AD:'.',Alt:'G'},{VAF:'.',AD:'1,2,3',Alt:'G'},{VAF:'.',AD:'10,5',Alt:'G,T'},{VAF:'.',AD:'10,0',Alt:'G'},{VAF:'NaN',AD:'10,5',Alt:'G'},{VAF:'.',AD:'9007199254740992,1',Alt:'G'}];
  connection.query('CREATE TABLE metrics (id INT, VAF VARCHAR, AD VARCHAR, Alt VARCHAR)');
  for(const [id,row] of fixtures.entries())connection.query(`INSERT INTO metrics VALUES (${id},${literal(row.VAF)},${literal(row.AD)},${literal(row.Alt)})`);
  const rows=connection.query(`SELECT id, ${sampleVafSQL(['VAF','AD','Alt'])} AS vaf FROM metrics ORDER BY id`).toArray();
  rows.forEach((row,i)=>{
    const expected=readSNVSample(fixtures[i]).alleleFrequency;
    if(expected===undefined)expect(row.vaf).toBeNull();else expect(row.vaf).toBeCloseTo(expected,12);
  });
  expect(connection.query(`SELECT id FROM metrics WHERE ${sampleVafSQL(['VAF','AD','Alt'])}>0.4 ORDER BY ${sampleVafSQL(['VAF','AD','Alt'])} DESC,id`).toArray().map(r=>r.id)).toEqual([2,0]);
});
it.skipIf(!process.env.SNV_ACCEPTANCE_FILE)('validates the existing production trio Parquet with browser WASM without rewriting source data',()=>{
  db.registerFileBuffer('production.parquet',new Uint8Array(readFileSync(process.env.SNV_ACCEPTANCE_FILE!)));
  connection.query("CREATE TABLE production AS SELECT * FROM read_parquet('production.parquet')");
  const raw=connection.query('DESCRIBE production').toArray().map(r=>String(r.column_name));
  const roles=process.env.SNV_SAMPLE_ROLES ? JSON.parse(process.env.SNV_SAMPLE_ROLES) : undefined;
  const mapping=sampleRoleSQL(raw,roles,'production');if(mapping)connection.query(mapping);
  if(roles){
    const target=connection.query("SELECT Genotype,AD,Depth,Genotype_father,AD_father,Genotype_mother,AD_mother FROM production WHERE CAST(Position AS BIGINT)=65099775 AND CAST(Chromosome AS VARCHAR) IN ('1','chr1') AND Ref='C' AND Alt='T'").toArray();
    expect(target).toHaveLength(1);
    expect(target[0].toJSON()).toMatchObject({Genotype:'1|0',AD:'63,68',Genotype_father:'0/0',AD_father:'53,0',Genotype_mother:'0/1',AD_mother:'58,59'});
  }
  expect(Number(connection.query('SELECT count(*) AS n FROM production').toArray()[0].n)).toBe(43592);
  const report=[];
  for(const role of ['', 'father','mother'] as const){
    const suffix=role?'_'+role:'';const expr=sampleVafSQL(raw,role);
    const result=connection.query(`SELECT count(*) AS n,count(${expr}) AS valid,count(*) FILTER (WHERE ${expr}>0) AS nonzero,count(*) FILTER (WHERE ${expr}=0) AS zero FROM production`).toArray()[0];
    expect(Number(result.valid)).toBeGreaterThan(42000);expect(Number(result.nonzero)).toBeGreaterThan(10000);
    for(const row of connection.query(`SELECT VAF${suffix} AS VAF,AD${suffix} AS AD,Alt, ${expr} AS effective FROM production LIMIT 100`).toArray()){
      const expected=readSNVSample(row.toJSON()).alleleFrequency;
      if(expected===undefined)expect(row.effective).toBeNull();else expect(row.effective).toBeCloseTo(expected,12);
    }
    report.push({role:role||'proband',valid:Number(result.valid),nonzero:Number(result.nonzero),zero:Number(result.zero)});
  }
  console.log('PRODUCTION_SAMPLE_METRICS',JSON.stringify(report));
},30000);

it('remaps the three sample groups simultaneously before VAF filtering and retains original row identity',()=>{
 const raw=['Genotype','AD','Depth','Genotype_father','AD_father','Depth_father','Genotype_mother','AD_mother','Depth_mother'];
 connection.query("CREATE TABLE identity_test(Genotype VARCHAR,AD VARCHAR,Depth VARCHAR,Genotype_father VARCHAR,AD_father VARCHAR,Depth_father VARCHAR,Genotype_mother VARCHAR,AD_mother VARCHAR,Depth_mother VARCHAR,__row_id VARCHAR)");
 connection.query("INSERT INTO identity_test VALUES ('0/0','53,0','53','0/1','58,59','117','1|0','63,68','131','stable-row')");
 connection.query(sampleRoleSQL(raw,{proband:'mother',father:'',mother:'father'},'identity_test')!);
 const row=connection.query('SELECT * FROM identity_test').toArray()[0].toJSON();
 expect(readSNVSample(row)).toMatchObject({genotype:'1|0',zygosity:'Heterozygous',alleleFrequency:68/131});
 expect(readSNVSample(row,'father')).toMatchObject({genotype:'0/0',zygosity:'Reference',alleleFrequency:0});
 expect(readSNVSample(row,'mother')).toMatchObject({genotype:'0/1',zygosity:'Heterozygous',alleleFrequency:59/117});
 expect(row.__row_id).toBe('stable-row');
});
