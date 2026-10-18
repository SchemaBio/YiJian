import * as React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {RawResultDownloads} from './RawResultDownloads';

const file={id:'bam-id',filename:'example.bam',size_bytes:2048,credits:0};
const catalog={transport:'local',version:'version-1',attempt_id:'attempt-1',zip_status:'pending',files:[file,{...file,id:'bai-id',filename:'example.bam.bai'}],bams:[file],missing:[]};
const reply=(data:unknown)=>new Response(JSON.stringify({data}),{status:200});
beforeEach(()=>{window.__YIJIAN_CONFIG__={API_URL:'/api',BACKEND:'octopus'};});
afterEach(()=>{vi.unstubAllGlobals();delete window.__YIJIAN_CONFIG__;});

it('lists authenticated self-hosted downloads without requesting quotes or active paid grants',async()=>{
 const fetch=vi.fn().mockImplementation(async(url:string)=>{
  if(url==='/api/v1/tasks/task/downloads')return reply(catalog);
  throw new Error('Unexpected endpoint: '+url);
 });
 vi.stubGlobal('fetch',fetch);
 render(<RawResultDownloads taskId="task"/>);
 await screen.findByText('example.bam');
 const links=screen.getAllByRole('link',{name:'下载'});
 expect(links[0]).toHaveAttribute('href','/api/v1/tasks/task/downloads/files/bam-id?attempt=attempt-1&version=version-1');
 expect(links[1]).toHaveAttribute('href','/api/v1/tasks/task/downloads/files/bai-id?attempt=attempt-1&version=version-1');
 expect(fetch).toHaveBeenCalledTimes(1);
 expect(fetch).toHaveBeenCalledWith('/api/v1/tasks/task/downloads',expect.objectContaining({credentials:'include'}));
 expect(screen.queryByText(/扣费|积分|确认领取链接/)).not.toBeInTheDocument();
});

it('prepares a local ZIP and links to the current attempt without a billing request',async()=>{
 let prepared=false;
 const fetch=vi.fn().mockImplementation(async(url:string,options:RequestInit)=>{
  if(url==='/api/v1/tasks/task/downloads/prepare'&&options.method==='POST'){prepared=true;return reply({...catalog,zip_status:'building'});}
  if(url==='/api/v1/tasks/task/downloads')return reply(prepared?{...catalog,zip_status:'ready',zip:{id:'zip-id',filename:'results.zip',size_bytes:100}}:catalog);
  throw new Error('Unexpected endpoint: '+url);
 });
 vi.stubGlobal('fetch',fetch);
 render(<RawResultDownloads taskId="task"/>);
 fireEvent.click(await screen.findByRole('button',{name:'准备结果 ZIP'}));
 const link=await screen.findByRole('link',{name:'下载结果 ZIP'});
 expect(link).toHaveAttribute('href','/api/v1/tasks/task/downloads/files/zip-id?attempt=attempt-1&version=version-1');
 expect(fetch.mock.calls.some(([url])=>/quote|issue|active/.test(String(url)))).toBe(false);
});

it('does not restore a previous task catalog after navigation',async()=>{
 let finishOld!:(response:Response)=>void;
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url:string)=>url==='/api/v1/tasks/old/downloads'?new Promise<Response>(resolve=>{finishOld=resolve;}):reply({...catalog,files:[{...file,filename:'current.bam'}]})));
 const view=render(<RawResultDownloads taskId="old"/>);
 view.rerender(<RawResultDownloads taskId="current"/>);
 await screen.findByText('current.bam');
 await act(async()=>{finishOld(reply({...catalog,files:[{...file,filename:'old.bam'}]}));});
 expect(screen.queryByText('old.bam')).not.toBeInTheDocument();
});
