import {expect,it,vi} from 'vitest';
import {pipelinesApi} from './task-resources';
import {readResourcePages} from './resource-pages';
vi.mock('./resource-pages',()=>({readResourcePages:vi.fn()}));
it('offers only active, usable trio pipelines after public availability is enabled',async()=>{
 vi.mocked(readResourcePages).mockResolvedValue([
  {id:'builtin-wes-family',name:'Trio',base_type:'wes_family',status:'active',resource_available:true},
  {id:'disabled-family',name:'Disabled',base_type:'wes_family',status:'inactive',resource_available:true},
  {id:'broken-family',name:'Broken',base_type:'wes_family',status:'active',resource_available:false},
  {id:'single',name:'Single',base_type:'wes_single',status:'active',resource_available:true},
  {id:'vcf',name:'VCF',base_type:'vcf_annotation',status:'active',resource_available:true},
 ]);
 expect((await pipelinesApi.list()).map(row=>row.id)).toEqual(['builtin-wes-family-hg19','single','vcf']);
});
