import * as React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {VCFTaskFields} from './VCFTaskFields';
import {readResourcePages} from '@/lib/resource-pages';
vi.mock('@/lib/resource-pages',()=>({readResourcePages:vi.fn()}));
vi.mock('@/lib/runtime-config',()=>({getRuntimeBackendFlavor:()=> 'octopus'}));
beforeEach(()=>vi.clearAllMocks());
it('lists only unexpired VCF choices and keeps internal sample name separate',async()=>{
 vi.mocked(readResourcePages).mockResolvedValue([{id:'valid',file_name:'multi.vcf.gz'},{id:'expired',file_name:'old.vcf',expires_at:'2020-01-01T00:00:00Z'}]);
 const onAsset=vi.fn(),onSample=vi.fn();render(<VCFTaskFields assetId="" sampleName="" onAssetChange={onAsset} onSampleChange={onSample}/>);
 await screen.findByRole('option',{name:/multi.vcf.gz/});expect(screen.queryByRole('option',{name:/old.vcf/})).not.toBeInTheDocument();
 expect(readResourcePages).toHaveBeenCalledWith('/v1/data/assets',{read_type:'vcf',status:'completed'});
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'valid'}});expect(onAsset).toHaveBeenCalledWith('valid');
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'S2'}});expect(onSample).toHaveBeenCalledWith('S2');
 expect(screen.queryByText(/按计算时间收费/)).not.toBeInTheDocument();
});
it('retries VCF list failures',async()=>{vi.mocked(readResourcePages).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);render(<VCFTaskFields assetId="" sampleName="" onAssetChange={vi.fn()} onSampleChange={vi.fn()}/>);fireEvent.click(await screen.findByRole('button',{name:'无法加载 VCF 文件，请重试'}));await waitFor(()=>expect(readResourcePages).toHaveBeenCalledTimes(2));});
