import type {AsyncDuckDBConnection} from '@duckdb/duckdb-wasm';
import {ident} from '../parquet-browser-sql';
import {ASSESSMENT_BATCH_SIZE,ASSESSMENT_FIELDS} from './transport';
import type {AssessmentRow,ResultTable} from './types';
import {optimizedAssessment} from './optimization';
import {batchPipeline} from './pipeline';

export async function streamAssessmentRows(
  conn:Pick<AsyncDuckDBConnection,'send'|'cancelSent'>,relation:string,columns:string[],
  table:ResultTable,consume:(rows:AssessmentRow[])=>Promise<void>,signal:AbortSignal,
) {
  const check=()=>{if(signal.aborted)throw new DOMException('请求已取消','AbortError');};
  const cnr=table==='cnv-segment'&&['Chromosome','Start','End','Col4','Col5','Col6','Col7','Col8'].every(field=>columns.includes(field));
  const fields=ASSESSMENT_FIELDS.filter(field=>columns.includes(field));
  let cancelling:Promise<unknown>|undefined;
  const cancel=()=>{cancelling??=conn.cancelSent().catch(()=>undefined);};
  signal.addEventListener('abort',cancel,{once:true});
  let complete=false;
  const pipeline=optimizedAssessment()?batchPipeline(consume,signal):undefined;
  const submit=pipeline?(rows:AssessmentRow[])=>pipeline.push(rows):consume;
  try {
    check();
    const stream=await conn.send(`SELECT ${['__row_id',...fields].map(ident).join(',')} FROM ${ident(relation)}`,true);
    let batch:AssessmentRow[]=[];
    for await(const chunk of stream){
      check();
      for(const record of chunk){
        const values=record.toJSON() as Record<string,unknown>;
        const id=String(values.__row_id);delete values.__row_id;
        batch.push({id,table,values,...(cnr?{coordinateSystem:'cnr-bed-zero-based-half-open' as const}:{})});
        if(batch.length===ASSESSMENT_BATCH_SIZE){check();await submit(batch);batch=[];}
      }
    }
    check();if(batch.length)await submit(batch);
    await pipeline?.finish();
    complete=true;
  } finally {
    if(!complete){pipeline?.stop();cancel();await pipeline?.finish().catch(()=>undefined);}
    signal.removeEventListener('abort',cancel);
    await cancelling;
  }
}
