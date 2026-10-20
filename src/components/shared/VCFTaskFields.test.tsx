import * as React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {VCFTaskFields} from './VCFTaskFields';
import {readResourcePage} from '@/lib/resource-pages';
vi.mock('@/lib/resource-pages',()=>({readResourcePage:vi.fn()}));
vi.mock('@/lib/runtime-config',()=>({getRuntimeBackendFlavor:()=> 'octopus'}));
beforeEach(()=>vi.clearAllMocks());
it('lists only unexpired VCF choices and keeps internal sample name separate',async()=>{
 vi.mocked(readResourcePage).mockResolvedValue({total:1,items:[{id:'valid',file_name:'multi.vcf.gz'},{id:'expired',file_name:'old.vcf',expires_at:'2020-01-01T00:00:00Z'}]});
 const onAsset=vi.fn(),onSample=vi.fn();render(<VCFTaskFields assetId="" sampleName="" onAssetChange={onAsset} onSampleChange={onSample}/>);
 await screen.findByRole('radio',{name:/multi.vcf.gz/});expect(screen.queryByRole('radio',{name:/old.vcf/})).not.toBeInTheDocument();
 expect(readResourcePage).toHaveBeenCalledWith('/v1/data/assets',expect.objectContaining({read_type:'vcf',available_only:'true',page_size:'20'}),expect.any(AbortSignal));
 fireEvent.click(screen.getByRole('radio',{name:/multi.vcf.gz/}));expect(onAsset).toHaveBeenCalledWith('valid');
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'S2'}});expect(onSample).toHaveBeenCalledWith('S2');
 expect(screen.queryByText(/按计算时间收费/)).not.toBeInTheDocument();
});
it('retries VCF list failures',async()=>{vi.mocked(readResourcePage).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({items:[],total:0});render(<VCFTaskFields assetId="" sampleName="" onAssetChange={vi.fn()} onSampleChange={vi.fn()}/>);fireEvent.click(await screen.findByRole('button',{name:'重试'}));await waitFor(()=>expect(readResourcePage).toHaveBeenCalledTimes(2));});
