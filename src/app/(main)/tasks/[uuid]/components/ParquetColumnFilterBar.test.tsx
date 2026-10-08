import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { api } from '@/lib/api';
import { DEFAULT_FILTER_STATE } from '../types';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';

vi.mock('@/components/shared/ToolbarPopover', () => ({ ToolbarPopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/api',()=>({api:{get:vi.fn(),put:vi.fn()}}));
vi.mock('../result-api',()=>({exportEffectiveTable:vi.fn()}));
vi.mock('@/lib/parquet-browser',()=>({retainBrowserTable:()=>()=>{},refreshBrowserTable:vi.fn().mockResolvedValue(undefined)}));

describe('personal filter synchronization',()=>{
  beforeEach(()=>vi.clearAllMocks());
  const preset={...DEFAULT_FILTER_STATE,searchQuery:'GENE',page:5,columnFilters:[{column:'GnomAD_AF',operator:'lte' as const,value:'0.001'}]};
  it('does not offer server computation switching', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    render(<ParquetColumnFilterBar taskId="task" table="snv-indel" columns={[]} state={DEFAULT_FILTER_STATE} onChange={vi.fn()} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByLabelText('筛选计算位置')).not.toBeInTheDocument();
    expect(screen.queryByText('服务器兼容模式')).not.toBeInTheDocument();
  });
  it('restores a saved filter repeatedly and resets pagination',async()=>{
    vi.mocked(api.get).mockResolvedValue([{name:'低频候选',stateJson:JSON.stringify(preset),version:3}]);
    const change=vi.fn();
    render(<ParquetColumnFilterBar taskId="task" table="snv-indel" columns={['Gene']} state={DEFAULT_FILTER_STATE} onChange={change}/>);
    await screen.findByRole('option',{name:'低频候选'});
    fireEvent.change(screen.getByLabelText('加载个人筛选方案'),{target:{value:'低频候选'}});
    fireEvent.click(screen.getByRole('button',{name:'应用方案'}));
    expect(change).toHaveBeenLastCalledWith({...preset,page:1});
    fireEvent.click(screen.getByRole('button',{name:'应用方案'}));
    expect(change).toHaveBeenCalledTimes(2);
  });
  it('saves structured personal state with a version and retains edits on conflict',async()=>{
    vi.mocked(api.get).mockResolvedValue([{name:'低频候选',stateJson:JSON.stringify(preset),version:3}]);
    vi.mocked(api.put).mockRejectedValueOnce(new Error('409 筛选方案已更新'));
    const change=vi.fn();
    render(<ParquetColumnFilterBar taskId="task" table="snv-indel" columns={['Gene']} state={preset} onChange={change}/>);
    await screen.findByRole('option',{name:'低频候选'});
    fireEvent.change(screen.getByLabelText('个人筛选方案名称'),{target:{value:'低频候选'}});
    fireEvent.click(screen.getByRole('button',{name:'保存方案'}));
    await screen.findByText('409 筛选方案已更新');
    expect(api.put).toHaveBeenCalledWith(expect.stringContaining('/tables/snv-indel/views'),{name:'低频候选',state:{...preset,page:1},expectedVersion:3});
    expect(screen.getByLabelText('个人筛选方案名称')).toHaveValue('低频候选');
    await waitFor(()=>expect(screen.getByRole('button',{name:'保存方案'})).toBeEnabled());
    expect(change).not.toHaveBeenCalled();
  });
});
