import {ident} from '@/lib/parquet-browser-sql';

// This is a suggested sequencing ISCN copy-state description, never a signed
// clinical conclusion. Preserve the original workflow annotation separately.
// CNR/BED coordinates are zero-based, half-open; ISCN uses one-based endpoints.
export function iscnCandidateSQL(raw:string[], table:string):string|null {
  const cn=table==='cnv-exon'?'Col12':'Col8';
  if(!['ISCN','Start','End','Col4',cn].every(f=>raw.includes(f)))return null;
  const number=`TRY_CAST(${ident(cn)} AS DOUBLE)`;
  const copies=`CAST(round(${number}) AS BIGINT)`;
  const start=`TRY_CAST(${ident('Start')} AS BIGINT)`;
  const end=`TRY_CAST(${ident('End')} AS BIGINT)`;
  const prefix=`regexp_extract(${ident('ISCN')}, '(seq\\[GRCh(?:37|38)\\] [0-9XY]+[pq][0-9.]+(?:[pq][0-9.]+)?)', 1)`;
  const kind=`upper(trim(${ident('Col4')}))`;
  return `CASE WHEN ${prefix}<>'' AND ${number} BETWEEN 0 AND 100 AND ${start}>=0 AND ${end}>${start}
    AND ((${kind} IN ('DEL','DELETION','LOSS') AND round(${number})<=1) OR (${kind} IN ('DUP','AMPLIFICATION','GAIN') AND round(${number})>=3))
    THEN ${prefix} || '(' || CAST(${start}+1 AS VARCHAR) || '_' || CAST(${end} AS VARCHAR) || ')x' || CAST(${copies} AS VARCHAR)
    ELSE NULL END`;
}
