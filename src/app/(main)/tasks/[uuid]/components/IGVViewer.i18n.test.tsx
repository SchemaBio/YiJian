import * as React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import igv from 'igv/dist/igv.esm.js';
import { IGVViewer } from './IGVViewer';
import type { IGVSession } from '../types';

const state = vi.hoisted(() => ({ locale: 'en' as 'en' | 'zh-Hant' }));
vi.mock('@/components/providers/LocaleProvider', () => ({ useAppLocale: () => state.locale }));
vi.mock('igv/dist/igv.esm.js', () => ({ default: { createBrowser: vi.fn(), removeBrowser: vi.fn() } }));
vi.mock('@/components/shared', () => ({ AppModal: ({children}: {children:React.ReactNode}) => <div>{children}</div> }));
vi.mock('../result-api', () => ({ getIGVSession: vi.fn(), getIGVTrackURLs: vi.fn(), getIGVSnapshot: vi.fn(async () => ({available:false})), saveIGVSnapshot: vi.fn() }));
afterEach(cleanup);

it('renders and updates translated tracks when the interface language changes', async () => {
  state.locale='en';
  const browser={ search:vi.fn().mockResolvedValue(undefined), loadTrack:vi.fn().mockResolvedValue({}), dispose:vi.fn(), updateViews:vi.fn(), currentLoci:vi.fn().mockReturnValue('chr1:1-110') };
  vi.mocked(igv.createBrowser).mockResolvedValue(browser as never);
  const session:IGVSession={taskUuid:'task',executionAttemptId:'attempt',version:'v',available:true,reference:{available:true,id:'hg19',fastaURL:'/fa',indexURL:'/fai',geneTrackURL:'/genes'},tracks:[
    {id:'bam:0',name:'先证者 BAM',type:'alignment',format:'bam',hasIndex:true,available:true},
    {id:'vcf:primary',name:'联合变异 VCF',type:'variant',format:'vcf',hasIndex:true,available:true},
    {id:'bed:target',name:'目标区域 BED',type:'annotation',format:'bed',hasIndex:false,available:true},
  ]};
  const props={taskId:'task',chromosome:'1',position:10,isOpen:true,onClose:vi.fn(),session};
  const view=render(<IGVViewer {...props}/>);
  await waitFor(()=>expect(browser.loadTrack).toHaveBeenCalledTimes(4));
  expect(browser.loadTrack).toHaveBeenCalledWith(expect.objectContaining({name:'Proband BAM'}));
  expect(browser.loadTrack).toHaveBeenCalledWith(expect.objectContaining({name:'Joint variant VCF'}));
  expect(browser.loadTrack).toHaveBeenCalledWith(expect.objectContaining({name:'Target regions BED'}));
  expect(browser.loadTrack).toHaveBeenCalledWith(expect.objectContaining({name:'Gene annotation'}));
  state.locale='zh-Hant'; view.rerender(<IGVViewer {...props}/>);
  await waitFor(()=>expect(browser.loadTrack).toHaveBeenCalledWith(expect.objectContaining({name:'先證者 BAM'})));
  expect(igv.removeBrowser).toHaveBeenCalled();
});
