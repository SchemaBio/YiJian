import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from '@/lib/api';
import { normalizeSampleDetail } from '@/lib/samples';
import { SampleSummaryCard } from './SampleSummaryCard';

vi.mock('@/lib/api', () => ({api:{get:vi.fn(), put:vi.fn()}}));
vi.mock('@/lib/hpo-terms', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/hpo-terms')>(),
  useHpoTerms: () => [{id:'HP:0001250', name:'癫痫发作'}, {id:'HP:0001263', name:'发育迟缓'}],
}));
vi.mock('@/components/shared/ToolbarPopover', () => ({ToolbarPopover: ({children, onOpenChange}: {children:React.ReactNode;onOpenChange:(open:boolean)=>void}) => {
  const [open, setOpen] = React.useState(false);
  return <><button onClick={() => {setOpen(!open);onOpenChange(!open);}}>样本详情</button>{open && children}</>;
}}));

const oldTerm = {id:'HP:0001250', name:'癫痫发作'};
const newTerm = {id:'HP:0001263', name:'发育迟缓'};
const raw = (terms = [oldTerm]) => ({id:'sample/id',internal_id:'SAMPLE',gender:'unknown',sample_type:'DNA',clinical_diagnosis:{mainDiagnosis:'原诊断',hpoTerms:terms},remark:'保留备注'});

describe('task sample HPO editing', () => {
  beforeEach(() => {vi.clearAllMocks();vi.mocked(api.get).mockResolvedValue(raw());});
  async function open(onSampleChange = vi.fn()) {
    render(<SampleSummaryCard sample={normalizeSampleDetail(raw())} onSampleChange={onSampleChange} />);
    fireEvent.click(screen.getByRole('button', {name:'样本详情'}));
    await waitFor(() => expect(screen.getByRole('button', {name:'编辑'})).toBeEnabled());
    return onSampleChange;
  }
  it('shows saved IDs, updates only HPO and notifies the task page', async () => {
    const changed = await open();
    expect(screen.getByText(oldTerm.id)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/v1/samples/sample%2Fid', {cache:'no-store'});
    fireEvent.click(screen.getByRole('button', {name:'编辑'}));
    fireEvent.click(screen.getByRole('button', {name:`移除 ${oldTerm.id}`}));
    fireEvent.change(screen.getByRole('textbox'), {target:{value:newTerm.id}});
    fireEvent.click(screen.getByRole('button', {name:`${newTerm.id} ${newTerm.name}`}));
    vi.mocked(api.put).mockResolvedValue({...raw(),clinical_diagnosis:'原诊断',hpo_terms:[newTerm]});
    fireEvent.click(screen.getByRole('button', {name:'保存'}));
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({clinicalDiagnosis:expect.objectContaining({mainDiagnosis:'原诊断',hpoTerms:[newTerm]}),remark:'保留备注'})));
    expect(api.put).toHaveBeenCalledWith('/v1/samples/sample%2Fid', {hpo_terms:[newTerm]});
    expect(screen.queryByText(oldTerm.id)).not.toBeInTheDocument();
  });
  it('reads changes from sample management whenever details reopen', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', {name:'样本详情'}));
    vi.mocked(api.get).mockResolvedValue(raw([newTerm]));
    fireEvent.click(screen.getByRole('button', {name:'样本详情'}));
    expect(await screen.findByText(newTerm.id)).toBeInTheDocument();
    expect(screen.queryByText(oldTerm.id)).not.toBeInTheDocument();
  });
  it('allows adding HPO to a sample that has none and prevents duplicate selection', async () => {
    vi.mocked(api.get).mockResolvedValue(raw([]));
    await open();
    expect(screen.getByText('暂无HPO术语')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'编辑'}));
    fireEvent.change(screen.getByRole('textbox'), {target:{value:oldTerm.id}});
    fireEvent.click(screen.getByRole('button', {name:`${oldTerm.id} ${oldTerm.name}`}));
    fireEvent.change(screen.getByRole('textbox'), {target:{value:oldTerm.id}});
    expect(screen.queryByRole('button', {name:`${oldTerm.id} ${oldTerm.name}`})).not.toBeInTheDocument();
    vi.mocked(api.put).mockResolvedValue({...raw(),hpo_terms:[oldTerm]});
    fireEvent.click(screen.getByRole('button', {name:'保存'}));
    await waitFor(() => expect(screen.getByRole('button', {name:'编辑'})).toBeEnabled());
    expect(api.put).toHaveBeenCalledWith('/v1/samples/sample%2Fid', {hpo_terms:[oldTerm]});
  });
  it('cancels a draft without changing the sample', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', {name:'编辑'}));
    fireEvent.click(screen.getByRole('button', {name:`移除 ${oldTerm.id}`}));
    fireEvent.click(screen.getByRole('button', {name:'取消'}));
    expect(screen.getByText(oldTerm.id)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });
  it('keeps failed edits available for retry and supports clearing every HPO', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', {name:'编辑'}));
    fireEvent.click(screen.getByRole('button', {name:`移除 ${oldTerm.id}`}));
    vi.mocked(api.put).mockRejectedValueOnce(new Error('network unavailable'));
    fireEvent.click(screen.getByRole('button', {name:'保存'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('network unavailable');
    expect(screen.getByText('暂无HPO术语')).toBeInTheDocument();
    vi.mocked(api.put).mockResolvedValue({...raw(),hpo_terms:[]});
    fireEvent.click(screen.getByRole('button', {name:'保存'}));
    await waitFor(() => expect(screen.getByRole('button', {name:'编辑'})).toBeEnabled());
    expect(api.put).toHaveBeenLastCalledWith('/v1/samples/sample%2Fid', {hpo_terms:[]});
  });
});
