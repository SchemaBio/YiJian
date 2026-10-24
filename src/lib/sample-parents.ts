import {api} from './api';
export type ParentAffectedStatus = '' | 'affected' | 'unaffected' | 'carrier';
export interface ParentSampleInfo {state:'empty'|'found'|'missing'|'ambiguous'|'unavailable';id?:string;internal_id?:string;gender?:string;data_ready:boolean;warning?:string}
export interface SampleParentValues {fatherSampleInternalId?:string;motherSampleInternalId?:string;fatherAffectedStatus?:ParentAffectedStatus;motherAffectedStatus?:ParentAffectedStatus;father?:ParentSampleInfo;mother?:ParentSampleInfo}
export interface TrioMember {role:string;sample_id:string;internal_id:string;gender:string;affected_status:string;read1_asset_id:string;read2_asset_id:string}
export interface TrioContext {ready:boolean;members:TrioMember[];errors:string[];warnings:string[];estimated_minutes:number}
export function normalizeParentFields(raw:Record<string,unknown>):SampleParentValues {
 return {fatherSampleInternalId:String(raw.fatherSampleInternalId??raw.father_sample_internal_id??''),motherSampleInternalId:String(raw.motherSampleInternalId??raw.mother_sample_internal_id??''),fatherAffectedStatus:(raw.fatherAffectedStatus??raw.father_affected_status??'') as ParentAffectedStatus,motherAffectedStatus:(raw.motherAffectedStatus??raw.mother_affected_status??'') as ParentAffectedStatus,father:raw.father as ParentSampleInfo|undefined,mother:raw.mother as ParentSampleInfo|undefined};
}
export function parentPayload(value:SampleParentValues) {
 return Object.fromEntries((['fatherSampleInternalId','motherSampleInternalId','fatherAffectedStatus','motherAffectedStatus'] as const).filter(key=>value[key]!==undefined).map(key=>[({fatherSampleInternalId:'father_sample_internal_id',motherSampleInternalId:'mother_sample_internal_id',fatherAffectedStatus:'father_affected_status',motherAffectedStatus:'mother_affected_status'} as const)[key],value[key]?.trim()]));
}
export function getTrioContext(sampleId:string,signal?:AbortSignal):Promise<TrioContext> {return api.get(`/v1/samples/${encodeURIComponent(sampleId)}/trio-context`,{cache:'no-store',signal});}
