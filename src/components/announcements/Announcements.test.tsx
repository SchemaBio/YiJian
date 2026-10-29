import * as React from 'react';
import {act,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({backend:'squid',get:vi.fn()}));
vi.mock('@/lib/api',()=>({api:{get:mocks.get}}));
vi.mock('@/lib/runtime-config',()=>({getRuntimeBackendFlavor:()=>mocks.backend}));
vi.mock('@/components/providers/AuthProvider',()=>({useAuth:()=>({user:{id:'test-user'}})}));
vi.mock('@/components/shared/AppModal',()=>({AppModal:({open,children,title}:{open:boolean;children:React.ReactNode;title:string})=>open?<div role="dialog" aria-label={title}>{children}</div>:null}));
import {AnnouncementsProvider,AnnouncementButton,AnnouncementBanners} from './Announcements';
const item={id:'notice-1',title:'维护通知',body:'<script>alert(1)</script>\n服务维护说明',starts_at:'2026-10-29T00:00:00Z',ends_at:'2026-10-30T00:00:00Z',banner:true,revision:1};
const view=()=>render(<AnnouncementsProvider><AnnouncementButton/><AnnouncementBanners/></AnnouncementsProvider>);
beforeEach(()=>{vi.clearAllMocks();mocks.backend='squid';localStorage.clear();mocks.get.mockResolvedValue({items:[item],server_time:new Date().toISOString()});});
afterEach(()=>vi.useRealTimers());
it('omits the feature and makes no requests in self-hosted mode',()=>{
 mocks.backend='octopus';view();expect(screen.queryByRole('button',{name:'公告'})).not.toBeInTheDocument();expect(mocks.get).not.toHaveBeenCalled();
});
it('keeps dismissed banners readable in the center and shows edited revisions again',async()=>{
 // Use a server-relative active window independent of the test machine clock.
 mocks.get.mockResolvedValue({items:[item],server_time:'2026-10-29T12:00:00Z'});
 const mounted=view();const close=await screen.findByRole('button',{name:'关闭公告：维护通知'});fireEvent.click(close);
 expect(screen.queryByRole('region',{name:'公告'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'公告'}));const dialog=screen.getByRole('dialog');expect(within(dialog).getByText('维护通知')).toBeInTheDocument();expect(dialog.querySelector('script')).toBeNull();expect(within(dialog).getByText(/<script>/)).toBeInTheDocument();
 mounted.unmount();view();await waitFor(()=>expect(mocks.get).toHaveBeenCalledTimes(3));expect(screen.queryByRole('button',{name:'关闭公告：维护通知'})).not.toBeInTheDocument();
 mocks.get.mockResolvedValue({items:[{...item,revision:2}],server_time:'2026-10-29T12:00:00Z'});fireEvent.click(screen.getByRole('button',{name:'公告'}));expect(await screen.findByRole('button',{name:'关闭公告：维护通知'})).toBeInTheDocument();
});
it('shows a read error instead of an empty success',async()=>{
 mocks.get.mockRejectedValue(new Error('unavailable'));view();fireEvent.click(screen.getByRole('button',{name:'公告'}));expect(await screen.findByRole('alert')).toHaveTextContent('公告暂时无法读取');expect(screen.queryByText('当前没有公告')).not.toBeInTheDocument();
});
it('expires banners using server time even when the client clock differs',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
 mocks.get.mockResolvedValue({items:[item],server_time:'2026-10-29T23:59:59Z'});view();await act(async()=>{await Promise.resolve();await Promise.resolve();});expect(screen.getByRole('button',{name:'关闭公告：维护通知'})).toBeInTheDocument();
 await act(async()=>{vi.advanceTimersByTime(1002);});expect(screen.queryByRole('button',{name:'关闭公告：维护通知'})).not.toBeInTheDocument();
});
