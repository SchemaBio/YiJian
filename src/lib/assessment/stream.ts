import type {AsyncDuckDBConnection} from '@duckdb/duckdb-wasm';
import {ident} from '../parquet-browser-sql';
import {ASSESSMENT_BATCH_SIZE,ASSESSMENT_FIELDS} from './transport';
import type {AssessmentRow,ResultTable} from './types';

export async function streamAssessmentRows(
  conn:Pick<AsyncDuckDBConnection,'send'|'cancelSent'>,relation:string,columns:string[],
  table:ResultTable,consume:(rows:AssessmentRow[])=>Promise<void>,signal:AbortSignal,
) {
  const check=()=>{if(signal.aborted)throw new DOMException('请求已取消','AbortError');};
  const fields=ASSESSMENT_FIELDS.filter(field=>columns.includes(field));
  let cancelling:Promise<unknown>|undefined;
  const cancel=()=>{cancelling??=conn.cancelSent().catch(()=>undefined);};
  signal.addEventListener('abort',cancel,{once:true});
  let complete=false;
  try {
    check();
    const stream=await conn.send(`SELECT ${['__row_id',...fields].map(ident).join(',')} FROM ${ident(relation)}`,true);
    let batch:AssessmentRow[]=[];
    for await(const chunk of stream){
      check();
      for(const record of chunk){
        const values=record.toJSON() as Record<string,unknown>;
        const id=String(values.__row_id);delete values.__row_id;
        batch.push({id,table,values});
        if(batch.length===ASSESSMENT_BATCH_SIZE){check();await consume(batch);batch=[];}
      }
    }
    check();if(batch.length)await consume(batch);
    complete=true;
  } finally {
    if(!complete)cancel();
    signal.removeEventListener('abort',cancel);
    await cancelling;
  }
}
