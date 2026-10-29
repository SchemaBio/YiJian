import * as React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {DownloadProtectionStatus} from './DownloadProtectionStatus';
import {api} from '@/lib/api';
vi.mock('@/lib/api',()=>({api:{post:vi.fn()}}));
beforeEach(()=>vi.clearAllMocks());
const grant={id:'grant',protection_version:1,bound_ip:'8.8.8.8',observed_bytes:8000000000,traffic_threshold_bytes:10400000000,issuance_state:'active'};
it('shows observed rather than guaranteed quota and submits only its own grant ID',async()=>{
 vi.mocked(api.post).mockResolvedValue({id:'request'});const updated=vi.fn();
 render(<DownloadProtectionStatus taskId="task" grant={grant} onUpdated={updated}/>);
 expect(screen.getByText(/10.4 GB/)).toBeInTheDocument();expect(screen.getByText(/统计有延迟/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'从当前网络申请管理员审核换绑'}));
 await waitFor(()=>expect(updated).toHaveBeenCalledOnce());
 expect(api.post).toHaveBeenCalledWith('/v1/tasks/task/downloads/network-requests',{grant_id:'grant'});
});
it('offers explicit repurchase without charging or issuing on render',()=>{
 const buy=vi.fn();render(<DownloadProtectionStatus taskId="task" grant={{...grant,issuance_state:'threshold'}} onUpdated={()=>{}} onRepurchase={buy}/>);
 expect(screen.queryByRole('button',{name:'从当前网络申请管理员审核换绑'})).not.toBeInTheDocument();
 expect(api.post).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:/重新购买下载授权/}));expect(buy).toHaveBeenCalledOnce();expect(api.post).not.toHaveBeenCalled();
});
