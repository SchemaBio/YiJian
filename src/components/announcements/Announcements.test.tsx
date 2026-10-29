import * as React from 'react';
import {act,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({backend:'squid',orgID:'11111111-1111-4111-8111-111111111111',get:vi.fn()}));
vi.mock('@/lib/api',()=>({api:{get:mocks.get}}));
vi.mock('@/lib/runtime-config',()=>({getRuntimeBackendFlavor:()=>mocks.backend}));
vi.mock('@/components/providers/AuthProvider',()=>({useAuth:()=>({user:{id:'test-user',orgId:mocks.orgID},currentOrg:{id:mocks.orgID}})}));
import {AnnouncementsProvider,AnnouncementButton,AnnouncementBanners} from './Announcements';
const item={id:'notice-1',title:'维护通知',body:'<script>alert(1)</script>\n服务维护说明',starts_at:'2026-10-29T00:00:00Z',ends_at:'2026-10-30T00:00:00Z',banner:true,revision:1};
const view=()=>render(<AnnouncementsProvider><AnnouncementButton/><AnnouncementBanners/></AnnouncementsProvider>);
beforeEach(()=>{vi.clearAllMocks();mocks.backend='squid';mocks.orgID='11111111-1111-4111-8111-111111111111';localStorage.clear();mocks.get.mockResolvedValue({items:[item],org_id:mocks.orgID,server_time:new Date().toISOString()});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('omits the feature and makes no requests in self-hosted mode',()=>{
 mocks.backend='octopus';view();expect(screen.queryByRole('button',{name:'公告'})).not.toBeInTheDocument();expect(mocks.get).not.toHaveBeenCalled();
});
it('keeps dismissed banners readable in the center and shows edited revisions again',async()=>{
 // Use a server-relative active window independent of the test machine clock.
 mocks.get.mockResolvedValue({items:[item],org_id:mocks.orgID,server_time:'2026-10-29T12:00:00Z'});
 const mounted=view();await act(async()=>{await Promise.resolve();});const close=screen.getByLabelText('关闭公告：维护通知');fireEvent.click(close);
 expect(screen.queryByRole('region',{name:'公告'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'公告'}));const dialog=screen.getByRole('dialog');expect(within(dialog).getByText('维护通知')).toBeInTheDocument();expect(dialog.querySelector('script')).toBeNull();expect(within(dialog).getByText(/<script>/)).toBeInTheDocument();
 mounted.unmount();view();await waitFor(()=>expect(mocks.get).toHaveBeenCalledTimes(3));expect(screen.queryByRole('button',{name:'关闭公告：维护通知'})).not.toBeInTheDocument();
 mocks.get.mockResolvedValue({items:[{...item,revision:2}],org_id:mocks.orgID,server_time:'2026-10-29T12:00:00Z'});fireEvent.click(screen.getByRole('button',{name:'公告'}));expect(await screen.findByRole('button',{name:'关闭公告：维护通知'})).toBeInTheDocument();
});
it('shows a read error instead of an empty success',async()=>{
 mocks.get.mockRejectedValue(new Error('unavailable'));view();fireEvent.click(screen.getByRole('button',{name:'公告'}));expect(await screen.findByRole('alert')).toHaveTextContent('公告暂时无法读取');expect(screen.queryByText('当前没有公告')).not.toBeInTheDocument();
});
it('expires banners using server time even when the client clock differs',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
 mocks.get.mockResolvedValue({items:[item],org_id:mocks.orgID,server_time:'2026-10-29T23:59:59Z'});view();await act(async()=>{await Promise.resolve();await Promise.resolve();});expect(screen.getByRole('button',{name:'关闭公告：维护通知'})).toBeInTheDocument();
 await act(async()=>{vi.advanceTimersByTime(1002);});expect(screen.queryByRole('button',{name:'关闭公告：维护通知'})).not.toBeInTheDocument();
});

it('clears the previous organization immediately and rejects a mismatched response',async()=>{
 mocks.get.mockResolvedValue({items:[item],org_id:mocks.orgID,server_time:'2026-10-29T12:00:00Z'});
 const mounted=view();await screen.findByRole('button',{name:'关闭公告：维护通知'});
 mocks.orgID='22222222-2222-4222-8222-222222222222';
 let finish!:(value:unknown)=>void;mocks.get.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 mounted.rerender(<AnnouncementsProvider><AnnouncementButton/><AnnouncementBanners/></AnnouncementsProvider>);
 expect(screen.queryByRole('button',{name:'关闭公告：维护通知'})).not.toBeInTheDocument();
 await act(async()=>{finish({items:[item],org_id:'11111111-1111-4111-8111-111111111111',server_time:'2026-10-29T12:00:00Z'});});
 expect(screen.queryByRole('button',{name:'关闭公告：维护通知'})).not.toBeInTheDocument();
 mocks.get.mockResolvedValue({items:[],org_id:mocks.orgID,server_time:'2026-10-29T12:00:00Z'});
 fireEvent.click(screen.getByRole('button',{name:'公告'}));await screen.findByText('当前没有公告');
 expect(mocks.get).toHaveBeenLastCalledWith('/v1/announcements',expect.objectContaining({coreApi:false}));
});

it('anchors a non-modal panel to the trigger and closes with Escape, outside pointer or a second click',async()=>{
 mocks.get.mockResolvedValue({items:[item],org_id:mocks.orgID,server_time:'2026-10-29T12:00:00Z'});
 view();await screen.findByLabelText('关闭公告：维护通知');
 const trigger=screen.getByRole('button',{name:'公告'});
 vi.spyOn(trigger,'getBoundingClientRect').mockReturnValue(new DOMRect(904,12,36,36));
 const overflow=document.body.style.overflow;const pointerEvents=document.body.style.pointerEvents;
 fireEvent.click(trigger);
 const panel=screen.getByRole('dialog',{name:'公告'});
 expect(panel).not.toHaveAttribute('aria-modal','true');
 expect(panel).toHaveStyle({position:'fixed',top:'58px',left:'480px',width:'460px'});
 expect(document.body.style.overflow).toBe(overflow);expect(document.body.style.pointerEvents).toBe(pointerEvents);
 fireEvent.keyDown(document,{key:'Escape'});
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(trigger).toHaveFocus();
 fireEvent.click(trigger);fireEvent.pointerDown(document.body);
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 fireEvent.click(trigger);fireEvent.click(trigger);
 await act(async()=>{await Promise.resolve();});
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('opens from a banner at the announcement button and fits a narrow viewport',async()=>{
 mocks.get.mockResolvedValue({items:[item],org_id:mocks.orgID,server_time:'2026-10-29T12:00:00Z'});
 view();await screen.findByLabelText('关闭公告：维护通知');
 vi.stubGlobal('innerWidth',320);
 fireEvent.click(screen.getByRole('button',{name:/维护通知.*查看完整公告/}));
 expect(screen.getByRole('dialog')).toHaveStyle({width:'296px',left:'12px'});
 fireEvent.click(screen.getByRole('button',{name:'关闭公告'}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'公告'})).toHaveFocus();
});
