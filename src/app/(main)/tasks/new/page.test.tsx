import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import {NewTaskModal} from '../components/NewTaskModal';
import NewAnalysisPage from './page';
import { tasksApi } from '@/lib/tasks';
import {readResourcePages} from '@/lib/resource-pages';
import { samplesApi } from '@/lib/task-resources';
import { listPedigrees, getPedigree } from '@/lib/pedigrees';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({}) }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => 'octopus' }));
vi.mock('@/lib/task-resources', () => ({
  samplesApi: { list: vi.fn(async () => []) },
  templatesApi:{list:vi.fn(async()=>[])},
  pipelinesApi: { list: vi.fn(async () => [
    { id: 'single', name: '单样本', baseType: 'wes_single' },
    { id: 'trio', name: '家系', baseType: 'wes_family' },
 {id:'vcf',name:'VCF 注释',baseType:'vcf_annotation',template:'vcf2anno'},
  ]) },
}));
vi.mock('@/lib/resource-pages',()=>({readResourcePages:vi.fn(async()=>[{id:'vcf-asset',file_name:'multi.vcf.gz'}])}));
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

it('loads family details only for a family workflow and reuses them when switching back', async () => {
  render(<NewAnalysisPage />);
  const pipeline = await screen.findByRole('combobox', { name: '选择分析流程' });
  await waitFor(() => expect(pipeline).toHaveValue('single'));
  expect(listPedigrees).not.toHaveBeenCalled();
  expect(getPedigree).not.toHaveBeenCalled();
  fireEvent.change(pipeline, { target: { value: 'trio' } });
  await screen.findByRole('option', { name: 'FAM-1（家系不完整）' });
  expect(listPedigrees).toHaveBeenCalledTimes(1);
  expect(getPedigree).toHaveBeenCalledWith('family');
  fireEvent.change(pipeline, { target: { value: 'single' } });
  fireEvent.change(pipeline, { target: { value: 'trio' } });
  await screen.findByRole('option', { name: 'FAM-1（家系不完整）' });
  expect(listPedigrees).toHaveBeenCalledTimes(1);
  expect(getPedigree).toHaveBeenCalledTimes(1);
});

it('provides a retry after task resources fail to load', async () => {
  vi.mocked(samplesApi.list).mockRejectedValueOnce(new Error('样本选项读取失败'));
  render(<NewAnalysisPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('样本选项读取失败');
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('combobox', { name: '选择分析流程' })).toHaveValue('single'));
});

it('retries family reads without losing the selected workflow', async () => {
  vi.mocked(listPedigrees).mockRejectedValueOnce(new Error('家系读取失败'));
  render(<NewAnalysisPage />);
  const pipeline = await screen.findByRole('combobox', { name: '选择分析流程' });
  await waitFor(() => expect(pipeline).toHaveValue('single'));
  fireEvent.change(pipeline, { target: { value: 'trio' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('家系读取失败');
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
  await screen.findByRole('option', { name: 'FAM-1（家系不完整）' });
  expect(pipeline).toHaveValue('trio');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('creates a VCF task without FASTQ and sends the selected asset and internal sample',async()=>{
 vi.mocked(samplesApi.list).mockResolvedValueOnce([{id:'business',internalId:'BIZ-1',matchedPair:null}]);
 render(<NewAnalysisPage/>);
 const pipeline=await screen.findByRole('combobox',{name:'选择分析流程'});await waitFor(()=>expect(pipeline).toHaveValue('single'));fireEvent.change(pipeline,{target:{value:'vcf'}});
 fireEvent.change(screen.getByRole('combobox',{name:'选择样本'}),{target:{value:'business'}});
 const file=await screen.findByRole('combobox',{name:'VCF 文件'});await screen.findByRole('option',{name:/multi.vcf.gz/});fireEvent.change(file,{target:{value:'vcf-asset'}});
 fireEvent.change(screen.getByRole('textbox',{name:'VCF 内样本名（可选）'}),{target:{value:'S2'}});
 expect(screen.queryByText('启用 CNV 分析')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'提交任务'}));
 await waitFor(()=>expect(tasksApi.create).toHaveBeenCalledWith(expect.objectContaining({sampleId:'business',pipelineId:'vcf',vcf_asset_id:'vcf-asset',vcf_sample_name:'S2',inputs:{}})));
 expect(tasksApi.estimate).toHaveBeenCalledWith(expect.objectContaining({vcf_asset_id:'vcf-asset'}));
});

it('preserves VCF inputs in the existing task modal and hides FASTQ readiness',async()=>{
 vi.mocked(samplesApi.list).mockResolvedValueOnce([{id:'business',internalId:'BIZ-1',matchedPair:null}]);
 const submit=vi.fn(async()=>{});render(<NewTaskModal isOpen onClose={vi.fn()} onSubmit={submit}/>);
 await screen.findByText(/BIZ-1/);
 const pipeline=await screen.findByRole('combobox');fireEvent.change(pipeline,{target:{value:'vcf'}});
 fireEvent.click(screen.getByText('BIZ-1'));
 await screen.findByRole('option',{name:/multi.vcf.gz/});fireEvent.change(screen.getByRole('combobox',{name:'VCF 文件'}),{target:{value:'vcf-asset'}});
 fireEvent.change(screen.getByRole('textbox',{name:'VCF 内样本名（可选）'}),{target:{value:'S2'}});
 expect(screen.queryByText('测序数据')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'创建任务'}));
 await waitFor(()=>expect(submit).toHaveBeenCalledWith(expect.objectContaining({vcf_asset_id:'vcf-asset',vcf_sample_name:'S2',inputs:{}})));
});
