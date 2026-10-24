import * as React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {SampleParentFields} from './SampleParentFields';
import {api} from '@/lib/api';
vi.mock('@/lib/api',()=>({api:{post:vi.fn()}}));
it('resolves parent internal IDs on the server and keeps unresolved values editable',async()=>{
 vi.mocked(api.post).mockResolvedValue({father:{state:'found',internal_id:'DAD',gender:'male',data_ready:true},mother:{state:'missing',data_ready:false}});
 const changed=vi.fn();render(<SampleParentFields value={{fatherSampleInternalId:'DAD',motherSampleInternalId:'MISSING'}} sampleId="child" onChange={changed}/>);
 expect(await screen.findByText(/已找到/)).toHaveTextContent('DAD');expect(screen.getByText('样本不存在')).toBeInTheDocument();
 expect(api.post).toHaveBeenCalledWith('/v1/samples/resolve-parents',expect.objectContaining({sample_id:'child',father_sample_internal_id:'DAD',mother_sample_internal_id:'MISSING'}));
 fireEvent.change(screen.getByRole('textbox',{name:'父亲样本'}),{target:{value:''}});
 expect(changed).toHaveBeenCalledWith(expect.objectContaining({fatherSampleInternalId:''}));
});
it('ignores stale parent lookup responses after the internal ID changes',async()=>{
 let completeOld:(value:unknown)=>void=()=>{};
 vi.mocked(api.post).mockImplementationOnce(()=>new Promise(resolve=>{completeOld=resolve;})).mockResolvedValueOnce({father:{state:'found',internal_id:'NEW',gender:'male',data_ready:true}});
 const {rerender}=render(<SampleParentFields value={{fatherSampleInternalId:'OLD'}} onChange={vi.fn()}/>);
 await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/v1/samples/resolve-parents',expect.objectContaining({father_sample_internal_id:'OLD'})));
 rerender(<SampleParentFields value={{fatherSampleInternalId:'NEW'}} onChange={vi.fn()}/>);
 expect(await screen.findByText(/已找到/)).toHaveTextContent('NEW');
 completeOld({father:{state:'found',internal_id:'OLD',gender:'male',data_ready:true}});
 await waitFor(()=>expect(screen.getByText(/已找到/)).toHaveTextContent('NEW'));
});
