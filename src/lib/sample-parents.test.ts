import {expect,it} from 'vitest';
import {parentPayload,normalizeParentFields} from './sample-parents';
import {sampleDetailPayload,samplePayload} from './samples';
import {parseSampleImport} from './sample-import';
it('distinguishes omitted updates from explicitly clearing all four fields',()=>{
 expect(parentPayload({})).toEqual({});
 expect(parentPayload({fatherSampleInternalId:'',motherSampleInternalId:'',fatherAffectedStatus:'',motherAffectedStatus:''})).toEqual({father_sample_internal_id:'',mother_sample_internal_id:'',father_affected_status:'',mother_affected_status:''});
 expect(sampleDetailPayload({fatherSampleInternalId:'DAD',fatherAffectedStatus:'carrier'})).toMatchObject({father_sample_internal_id:'DAD',father_affected_status:'carrier'});
 expect(normalizeParentFields({father_sample_internal_id:'renamed',father_affected_status:'carrier',father:{state:'found',id:'stable'}})).toMatchObject({fatherSampleInternalId:'renamed',fatherAffectedStatus:'carrier',father:{id:'stable'}});
});
it('imports localized parent statuses and unresolved IDs without losing blank status',()=>{
 const result=parseSampleImport('Sample ID,Internal ID,Sex,Sample type,Batch,Clinical diagnosis,Father sample,Mother sample,Father status,Mother status\nS,C,male,DNA,,,DAD,MOM,carrier,\n');
 expect(result.issues).toEqual([]);expect(result.rows[0].data).toMatchObject({fatherSampleInternalId:'DAD',motherSampleInternalId:'MOM',fatherAffectedStatus:'carrier',motherAffectedStatus:''});
 expect(samplePayload(result.rows[0].data)).toMatchObject({father_sample_internal_id:'DAD',mother_sample_internal_id:'MOM',father_affected_status:'carrier',mother_affected_status:''});
});
it('rejects unsupported parent statuses in imports',()=>{
 const result=parseSampleImport('Sample ID,Internal ID,Sex,Sample type,Batch,Clinical diagnosis,Father sample,Mother sample,Father status,Mother status\nS,C,male,DNA,,,DAD,MOM,invalid,\n');
 expect(result.issues).toEqual([{line:2,key:'sampleParents.invalidStatus'}]);
});
