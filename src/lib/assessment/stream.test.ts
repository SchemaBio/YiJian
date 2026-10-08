import {expect,it,vi} from 'vitest';
import type {AsyncDuckDBConnection} from '@duckdb/duckdb-wasm';
import {streamAssessmentRows} from './stream';

function connection(total:number){
  const send=vi.fn(async()=> (async function*(){
    for(let offset=0;offset<total;offset+=2048)yield Array.from({length:Math.min(2048,total-offset)},(_,i)=>({toJSON:()=>({__row_id:String(offset+i),Gene:'G'})}));
  })());
  const cancelSent=vi.fn(async()=>true);
  return {send,cancelSent} as unknown as Pick<AsyncDuckDBConnection,'send'|'cancelSent'>;
}
it('streams 138,919 records with one projected query and bounded sequential batches',async()=>{
  const conn=connection(138919);
  let processed=0,busy=false;
  const consume=async(rows:Parameters<Parameters<typeof streamAssessmentRows>[4]>[0])=>{
    expect(busy).toBe(false);busy=true;
    expect(rows.length).toBeLessThanOrEqual(1000);
    expect(rows[0].id).toBe(String(processed));processed+=rows.length;
    await Promise.resolve();busy=false;
  };
  await streamAssessmentRows(conn,'source',['__row_id','Gene','HugeAnnotation'],'snv-indel',consume,new AbortController().signal);
  expect(processed).toBe(138919);
  expect(conn.send).toHaveBeenCalledTimes(1);
  expect(conn.send).toHaveBeenCalledWith('SELECT "__row_id","Gene" FROM "source"',true);
  expect(conn.cancelSent).not.toHaveBeenCalled();
});
it('stops after cancellation and waits for DuckDB cancellation before cleanup',async()=>{
  const conn=connection(55393),controller=new AbortController();
  const consume=vi.fn(async()=>controller.abort());
  await expect(streamAssessmentRows(conn,'source',['Gene'],'snv-indel',consume,controller.signal)).rejects.toMatchObject({name:'AbortError'});
  expect(consume).toHaveBeenCalledTimes(1);
  expect(conn.cancelSent).toHaveBeenCalledTimes(1);
});
it('cancels an open query if the assessment worker rejects a batch',async()=>{
  const conn=connection(55393);
  await expect(streamAssessmentRows(conn,'source',['Gene'],'snv-indel',async()=>{throw new Error('worker failed');},new AbortController().signal)).rejects.toThrow('worker failed');
  expect(conn.cancelSent).toHaveBeenCalledTimes(1);
});
