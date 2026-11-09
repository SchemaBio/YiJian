import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import {NewTaskModal} from '../components/NewTaskModal';
import NewAnalysisPage from './page';
import {getTrioContext} from '@/lib/sample-parents';
import { tasksApi } from '@/lib/tasks';
import {readResourcePage} from '@/lib/resource-pages';
import { LocaleProvider } from '@/components/providers/LocaleProvider';
import { pipelinesApi } from '@/lib/task-resources';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

import { listPedigrees, getPedigree } from '@/lib/pedigrees';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({}) }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: vi.fn(() => 'octopus') }));
vi.mock('@/lib/task-resources', async importOriginal => ({...await importOriginal<typeof import('@/lib/task-resources')>(),
  samplesApi: { list: vi.fn(async () => []) },
  templatesApi:{list:vi.fn(async()=>[])},
  pipelinesApi: { list: vi.fn(async () => [
    { id: 'single', name: '单样本', baseType: 'wes_single' },
    { id: 'trio', name: '家系', baseType: 'wes_family' },
 {id:'vcf',name:'VCF 注释',baseType:'vcf_annotation',template:'vcf2anno'},
  ]) },
}));
vi.mock('@/lib/resource-pages',()=>({readResourcePage:vi.fn(async(endpoint:string)=>({items:endpoint==='/v1/samples'?[{id:'business',internal_id:'BIZ-1'}]:[{id:'vcf-asset',file_name:'multi.vcf.gz'}],total:1}))}));
vi.mock('@/lib/sample-parents',async original=>({...await original<typeof import('@/lib/sample-parents')>(),getTrioContext:vi.fn(async()=>({ready:true,members:[{role:'father',internal_id:'DAD',gender:'male',affected_status:'carrier'},{role:'mother',internal_id:'MOM',gender:'female',affected_status:''}],errors:[],warnings:[],estimated_minutes:100}))}));
vi.mock('@/lib/tasks',()=>({tasksApi:{estimate:vi.fn(async()=>({estimated_minutes:60})),create:vi.fn(async()=>({id:'created'}))}}));
vi.mock('@/lib/pedigrees', () => ({
  listPedigrees: vi.fn(async () => [{ id: 'family' }]),
  getPedigree: vi.fn(async () => ({ id: 'family', internalId: 'FAM-1', members: [], probandId: '' })),
}));
vi.mock('@schema/ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@schema/ui-kit')>();
  return { ...actual, Select: ({ options, value, onChange, placeholder }: any) => (
    <select aria-label={placeholder} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option: any) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
  ) };
});

it('offers trio workflows without requesting pedigree data', async () => {
  render(<NewAnalysisPage />);
  const pipeline = await screen.findByRole('combobox', {name:'选择分析流程'});
  await waitFor(() => expect(pipeline).toHaveValue('single'));
  expect(screen.getByRole('option', {name:'家系'})).toBeEnabled();
  expect(listPedigrees).not.toHaveBeenCalled();
  expect(getPedigree).not.toHaveBeenCalled();
});

it('translates generated notes while keeping edited notes on language changes', async () => {
  vi.mocked(pipelinesApi.list).mockResolvedValueOnce([
    { id: 'builtin-wes-single-hg38', name: '单样本', baseType: 'wes_single', version: '' },
  ]);
  const { rerender } = render(<LocaleProvider initialLocale="zh-CN"><NewAnalysisPage /></LocaleProvider>);
  fireEvent.click(await screen.findByRole('radio', { name: /BIZ-1/ }));
  expect(screen.queryByText('高级选项')).not.toBeInTheDocument();
  rerender(<LocaleProvider initialLocale="en"><NewAnalysisPage /></LocaleProvider>);
  const notes = await screen.findByRole('textbox', { name: 'Task notes' });
  expect(notes).toHaveValue('BIZ-1 WES single-sample analysis_hg38 analysis');
  fireEvent.change(notes, { target: { value: 'Custom notes' } });
  rerender(<LocaleProvider initialLocale="zh-CN"><NewAnalysisPage /></LocaleProvider>);
  expect(await screen.findByRole('textbox', { name: '任务备注' })).toHaveValue('Custom notes');
});

it('shows the SaaS retention checkbox as checked and unlocks submission', async () => {
  vi.mocked(getRuntimeBackendFlavor).mockReturnValue('squid');
  const view = render(<NewAnalysisPage />);
  try {
    fireEvent.click(await screen.findByRole('radio', { name: /BIZ-1/ }));
    const checkbox = screen.getByRole('checkbox', { name: /我已阅读并了解上述保留期限/ });
    const submit = screen.getByRole('button', { name: '提交任务' });
    expect(submit).toBeDisabled();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(submit).toBeEnabled();
  } finally {
    view.unmount();
    vi.mocked(getRuntimeBackendFlavor).mockReturnValue('octopus');
  }
});

it('provides a retry after task resources fail to load', async () => {
  vi.mocked(readResourcePage).mockRejectedValueOnce(new Error('样本选项读取失败'));
  render(<NewAnalysisPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('样本选项读取失败');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('combobox', { name: '选择分析流程' })).toHaveValue('single'));
});

it('creates a VCF task without FASTQ and sends the selected asset and internal sample',async()=>{
 render(<NewAnalysisPage/>);
 const pipeline=await screen.findByRole('combobox',{name:'选择分析流程'});await waitFor(()=>expect(pipeline).toHaveValue('single'));fireEvent.change(pipeline,{target:{value:'vcf'}});
 fireEvent.click(await screen.findByRole('radio',{name:/BIZ-1/}));
 fireEvent.click(await screen.findByRole('radio',{name:/multi.vcf.gz/}));
 fireEvent.change(screen.getByRole('textbox',{name:'VCF 内样本名（可选）'}),{target:{value:'S2'}});
 expect(screen.queryByText('启用 CNV 分析')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'提交任务'}));
 await waitFor(()=>expect(tasksApi.create).toHaveBeenCalledWith(expect.objectContaining({sampleId:'business',pipelineId:'vcf',vcf_asset_id:'vcf-asset',vcf_sample_name:'S2',inputs:{}})));
 expect(tasksApi.estimate).toHaveBeenCalledWith(expect.objectContaining({vcf_asset_id:'vcf-asset'}));
});

it('preserves VCF inputs in the existing task modal and hides FASTQ readiness',async()=>{
 const submit=vi.fn(async()=>{});render(<NewTaskModal isOpen onClose={vi.fn()} onSubmit={submit}/>);
 await screen.findByText(/BIZ-1/);
 const pipeline=await screen.findByRole('combobox');fireEvent.change(pipeline,{target:{value:'vcf'}});
 fireEvent.click(screen.getByRole('radio',{name:/BIZ-1/}));
 fireEvent.click(await screen.findByRole('radio',{name:/multi.vcf.gz/}));
 fireEvent.change(screen.getByRole('textbox',{name:'VCF 内样本名（可选）'}),{target:{value:'S2'}});
 expect(screen.queryByText('测序数据')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'创建任务'}));
 await waitFor(()=>expect(submit).toHaveBeenCalledWith(expect.objectContaining({vcf_asset_id:'vcf-asset',vcf_sample_name:'S2',inputs:{}})));
});

it.each([
 ['page',true], ['modal',true], ['page',false], ['modal',false],
] as const)('submits a proband through the %s entrypoint (data ready: %s)',async (entry,ready)=>{
 if(!ready)vi.mocked(getTrioContext).mockResolvedValueOnce({
  ready:false,waiting_for_data:true,
  members:[{role:'father',sample_id:'father',internal_id:'DAD',gender:'male',affected_status:'carrier',read1_asset_id:'',read2_asset_id:''}],
  errors:[],warnings:[],estimated_minutes:60,
 });
 vi.mocked(tasksApi.create).mockClear();
 vi.mocked(tasksApi.estimate).mockClear();
 const submit=vi.fn(async()=>{});
 if(entry==='page')render(<NewAnalysisPage/>);else render(<NewTaskModal isOpen onClose={vi.fn()} onSubmit={submit}/>);
 const pipeline=await screen.findByRole('combobox');await waitFor(()=>expect(pipeline).toHaveValue('single'));
 fireEvent.change(pipeline,{target:{value:'trio'}});
 fireEvent.click(await screen.findByRole('radio',{name:/BIZ-1/}));
 await screen.findByText(/DAD/);
 if(!ready)expect(screen.getByText(/可以先创建 Trio 任务/)).toBeInTheDocument();
 expect(screen.getByText(/携带者/)).toBeInTheDocument();
 expect(getTrioContext).toHaveBeenCalledWith('business',expect.any(AbortSignal));
 await waitFor(()=>expect(tasksApi.estimate).toHaveBeenCalledWith(expect.objectContaining({sampleId:'business',pipelineId:'trio'})));
 expect(readResourcePage).toHaveBeenCalledWith('/v1/samples',expect.objectContaining({analysis_type:'trio'}),expect.any(AbortSignal));
 fireEvent.click(screen.getByRole('button',{name:entry==='page'?'提交任务':'创建任务'}));
 await waitFor(()=>expect(entry==='page'?tasksApi.create:submit).toHaveBeenCalledWith(expect.objectContaining({sampleId:'business',pipelineId:'trio'})));
 const request=vi.mocked(entry==='page'?tasksApi.create:submit).mock.calls.at(-1)?.[0];expect(request).not.toHaveProperty('pedigreeId');
});
it('blocks trio submission when preflight reports incomplete data',async()=>{
 vi.mocked(getTrioContext).mockResolvedValueOnce({ready:false,members:[],errors:['incomplete test input'],warnings:[],estimated_minutes:0});
 render(<NewAnalysisPage/>);const pipeline=await screen.findByRole('combobox');await waitFor(()=>expect(pipeline).toHaveValue('single'));fireEvent.change(pipeline,{target:{value:'trio'}});
 fireEvent.click(await screen.findByRole('radio',{name:/BIZ-1/}));await screen.findByText('incomplete test input');
 expect(screen.getByRole('button',{name:'提交任务'})).toBeDisabled();
});
