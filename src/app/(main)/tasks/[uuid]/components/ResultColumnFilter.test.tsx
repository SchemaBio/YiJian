import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { filterableColumns, resultColumnLabels } from './ResultColumnFilter';
import { DEFAULT_FILTER_STATE } from '../types';

it('opens a hinted column filter and applies its value without triggering the row', async () => {
  const onChange = vi.fn();
  const onRowClick = vi.fn();
  const columns = filterableColumns<{ Chromosome: string }>([{ id: 'Chromosome', header: '染色体', accessor: 'Chromosome' }],
    { columns: ['Chromosome'] }, DEFAULT_FILTER_STATE, onChange, 'snv-indel');
  render(<div onClick={onRowClick}>{columns[0].header as React.ReactNode}</div>);
  fireEvent.click(screen.getByRole('button', { name: '染色体筛选' }));
  const input = await screen.findByRole('textbox', { name: '筛选值' });
  fireEvent.change(input, { target: { value: 'chr1' } });
  fireEvent.click(screen.getByRole('button', { name: '应用' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    page: 1, columnFilters: [{ column: 'Chromosome', operator: 'contains', value: 'chr1' }],
  }));
  expect(onRowClick).not.toHaveBeenCalled();
});

it.each(['cnv-segment', 'cnv-exon'])('shows the type name and applies exclusion to the original field for %s', async table => {
  const change = vi.fn();
  const columns = filterableColumns([{ id: 'type', header: '类型', accessor: 'type' }],
    { columns: ['Col4'], columnAliases: { Col4: ['type'] } }, DEFAULT_FILTER_STATE, change, table);
  render(<>{columns[0].header as React.ReactNode}</>);
  fireEvent.click(screen.getByRole('button', { name: '类型筛选' }));
  await screen.findByLabelText('类型筛选条件');
  expect(screen.queryByText('Col4')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('筛选方式'), { target: { value: 'not_contains' } });
  fireEvent.change(screen.getByLabelText('CNV 类型'), { target: { value: 'DUP' } });
  fireEvent.click(screen.getByRole('button', { name: '应用' }));
  expect(change).toHaveBeenCalledWith(expect.objectContaining({ columnFilters: [{ column: 'Col4', operator: 'not_contains', value: 'DUP' }], page: 1 }));
});

it('keeps different meanings of numbered columns in Region and Exon', () => {
  expect(resultColumnLabels([], { columns: ['Col5', 'Col8'] }, 'cnv-segment')).toMatchObject({ Col5: 'log2 ratio', Col8: '拷贝数' });
  expect(resultColumnLabels([], { columns: ['Col5', 'Col8'] }, 'cnv-exon')).toMatchObject({ Col5: '基因', Col8: '外显子数' });
});

it('initializes chromosome filtering when coordinate metadata arrives after loading', async () => {
  const onChange = vi.fn();
  function Header({ loaded }: { loaded: boolean }) {
    const columns = filterableColumns([{ id: 'position', header: '变异位置', accessor: 'position' }],
      loaded ? { columns: ['Chromosome', 'Position'], columnTypes: { Chromosome: 'text', Position: 'number' } } : null,
      DEFAULT_FILTER_STATE, onChange, 'snv-indel');
    return <>{columns[0].header as React.ReactNode}</>;
  }
  const { rerender } = render(<Header loaded={false} />);
  rerender(<Header loaded />);
  fireEvent.click(await screen.findByRole('button', { name: '染色体筛选' }));
  expect(screen.getByLabelText('筛选字段')).toHaveValue('Chromosome');
  fireEvent.change(screen.getByLabelText('筛选方式'), { target: { value: 'equals' } });
  fireEvent.change(screen.getByRole('textbox', { name: '筛选值' }), { target: { value: 'chr1' } });
  fireEvent.click(screen.getByRole('button', { name: '应用' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ page: 1, columnFilters: [{ column: 'Chromosome', operator: 'equals', value: 'chr1' }] }));
});
