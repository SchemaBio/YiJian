import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import {NewTaskModal} from '../components/NewTaskModal';
import NewAnalysisPage from './page';
import {getTrioContext} from '@/lib/sample-parents';
import { tasksApi } from '@/lib/tasks';
import {readResourcePage} from '@/lib/resource-pages';

import { listPedigrees, getPedigree } from '@/lib/pedigrees';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({}) }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => 'octopus' }));
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

it.each(['page','modal'])('submits a proband sample through the %s entrypoint',async entry=>{
 const submit=vi.fn(async()=>{});
 if(entry==='page')render(<NewAnalysisPage/>);else render(<NewTaskModal isOpen onClose={vi.fn()} onSubmit={submit}/>);
 const pipeline=await screen.findByRole('combobox');await waitFor(()=>expect(pipeline).toHaveValue('single'));
 fireEvent.change(pipeline,{target:{value:'trio'}});
 fireEvent.click(await screen.findByRole('radio',{name:/BIZ-1/}));
 await screen.findByText(/DAD/);
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
