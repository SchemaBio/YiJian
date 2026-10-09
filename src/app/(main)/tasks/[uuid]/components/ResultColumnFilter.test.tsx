import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { filterableColumns } from './ResultColumnFilter';
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
