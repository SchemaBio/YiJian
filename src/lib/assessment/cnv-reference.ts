import manifest from './cnv-reference-manifest.json';
import type {AssessmentContext, AssessmentRow, DosageRecord, Interval} from './types';
import {optimizedAssessment} from './optimization';

const references=new Map<string,NonNullable<AssessmentContext['cnvReference']>>();
export function clearCNVReferenceCache(){references.clear();}

export async function loadCNVReference(context:AssessmentContext,signal:AbortSignal) {
 const entry=manifest[context.reference as keyof typeof manifest];
 if(!entry)throw new Error('CNV_REFERENCE_UNAVAILABLE');
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const cached=optimizedAssessment()?references.get(entry.sha256):undefined;
 if(cached)return cached;
 const response=await fetch(entry.url,{signal,credentials:'same-origin'});
 if(!response.ok||Number(response.headers.get('Content-Length'))>2*1024*1024)throw new Error('CNV_REFERENCE_UNAVAILABLE');
 const raw=await response.arrayBuffer();if(raw.byteLength!==entry.bytes)throw new Error('CNV_REFERENCE_INVALID');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==entry.sha256)throw new Error('CNV_REFERENCE_INVALID');
 const pack=JSON.parse(new TextDecoder().decode(raw));
 if(pack.reference!==context.reference||pack.version!==entry.version||pack.coordinateSystem!=='zero-based-half-open'||!Array.isArray(pack.dosage)||!pack.dosage.length||pack.dosage.some((d:DosageRecord)=>d.reference!==context.reference||!d.chromosome||!d.id||!d.source||!Number.isSafeInteger(d.start)||!Number.isSafeInteger(d.end)||d.start<0||d.end<=d.start||!Number.isInteger(d.hi)||!Number.isInteger(d.ts)))throw new Error('CNV_REFERENCE_INVALID');
 const result={sha256:hash,version:pack.version as string,dosage:pack.dosage as DosageRecord[]};
 if(optimizedAssessment())references.set(hash,result);
 return result;
}
const dosageCache=new WeakMap<AssessmentContext,DosageRecord[]>();
export function dosageRecords(context:AssessmentContext) {
 let records=dosageCache.get(context);
 if(!records){records=[...context.pack.dosage,...(context.cnvReference?.dosage??[])];dosageCache.set(context,records);}
 return records;
}

export function cnvInterval(row:AssessmentRow,context:AssessmentContext):Interval|undefined {
 const proof=context.proofs[row.id];
 if(proof?.interval)return proof.reference===context.reference&&proof.interval.reference===context.reference?proof.interval:undefined;
 // The stream tags only the workflow's verified CNR/BED eight-column schema.
 // Never infer coordinates from a generic Start/End or a report evidence label.
 if(row.table!=='cnv-segment'||row.coordinateSystem!=='cnr-bed-zero-based-half-open'||!['hg19','hg38'].includes(context.reference))return;
 const start=row.values.Start,end=row.values.End,chr=row.values.Chromosome;
 const value=(x:unknown)=>typeof x==='bigint'?Number(x):typeof x==='number'||typeof x==='string'&&/^\d+$/.test(x)?Number(x):NaN;
 const a=value(start),b=value(end),chromosome=String(chr??'').replace(/^chr/i,'').toUpperCase();
 if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<=a||!/^([1-9]|1\d|2[0-2]|X|Y|MT|M)$/.test(chromosome))return;
 return {reference:context.reference,chromosome:chromosome==='M'?'MT':chromosome,start:a,end:b};
}
