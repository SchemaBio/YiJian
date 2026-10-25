import type { AssessmentContext, AssessmentRow, ReferenceSupplement } from './types';
import { annotationGenes } from './row-annotations';

export function referenceGenes(rows:AssessmentRow[],context?:AssessmentContext):string[]{return [...new Set(rows.flatMap(row=>{
  const genes=annotationGenes(row);if(genes.length||!context)return genes;
  const interval=context.proofs[row.id]?.interval;if(!interval||interval.reference!==context.reference)return genes;
  const chr=interval.chromosome.replace(/^chr/i,'');
  return context.pack.dosage.filter(record=>record.gene&&record.reference===interval.reference&&record.chromosome.replace(/^chr/i,'')===chr&&interval.start<record.end&&record.start<interval.end).map(record=>record.gene!);
}))];}
export async function loadReferences(context:AssessmentContext,genes:string[],signal:AbortSignal,rank=false):Promise<ReferenceSupplement>{
  const combined:ReferenceSupplement={resourceVersion:context.referenceVersion!,version:'',canonical:{},matches:{},background:{},warnings:[]};
  for(let start=0;start<genes.length || start===0;start+=512){
    const batch=genes.slice(start,start+512);let cursor:number|undefined;
    do{
      const response=await fetch(`/reference-api/assessment/${encodeURIComponent(context.taskId)}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({contextVersion:context.version,resourceVersion:context.referenceVersion,genes:batch,cursor,rank}),signal});
      if(!response.ok)throw new Error(response.status===409?'REFERENCE_VERSION_CHANGED':'REFERENCE_UNAVAILABLE');
      const value=await response.json() as ReferenceSupplement;
      if(value.resourceVersion!==context.referenceVersion)throw new Error('REFERENCE_VERSION_CHANGED');
      Object.assign(combined.canonical,value.canonical);Object.assign(combined.matches,value.matches);Object.assign(combined.background,value.background);
      combined.version=value.version;combined.warnings=value.warnings;
      if(value.geneRanking)combined.geneRanking=value.geneRanking;
      if(value.nextCursor!==undefined && (value.nextCursor<=(cursor??0)||value.nextCursor>=batch.length))throw new Error('INVALID_REFERENCE_CURSOR');
      cursor=value.nextCursor;
    }while(cursor!==undefined);
    if(!genes.length)break;
  }
  return combined;
}
