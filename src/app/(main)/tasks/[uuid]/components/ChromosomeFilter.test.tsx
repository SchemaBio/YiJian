import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ChromosomeFilter } from './ChromosomeFilter';
import { DEFAULT_FILTER_STATE, type TableFilterState } from '../types';

it('filters one chromosome exactly, preserves other filters and resets pagination', () => {
  const onChange = vi.fn();
  const gene = { column: 'Gene', operator: 'equals' as const, value: 'BRCA1' };
  const state: TableFilterState = { ...DEFAULT_FILTER_STATE, page: 5, columnFilters: [gene] };
  render(<ChromosomeFilter column="Chromosome" state={state} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('染色体'), { target: { value: '1' } });
  expect(onChange).toHaveBeenCalledWith({ ...state, page: 1, columnFilters: [gene, { column: 'Chromosome', operator: 'in', value: ['1', 'chr1', 'CHR1', 'Chr1'] }] });
});

it('reflects existing filters, handles mitochondrial aliases and clears only the chromosome', () => {
  const onChange = vi.fn();
  const gene = { column: 'Gene', operator: 'equals' as const, value: 'BRCA1' };
  const state: TableFilterState = { ...DEFAULT_FILTER_STATE, columnFilters: [gene, { column: 'Chromosome', operator: 'equals', value: 'chrM' }] };
  const { rerender } = render(<ChromosomeFilter column="Chromosome" state={state} onChange={onChange} />);
  expect(screen.getByLabelText('染色体')).toHaveValue('MT');
  fireEvent.change(screen.getByLabelText('染色体'), { target: { value: '' } });
  expect(onChange).toHaveBeenLastCalledWith({ ...state, page: 1, columnFilters: [gene] });
  rerender(<ChromosomeFilter column="Chromosome" state={{ ...state, columnFilters: [{ column: 'Chromosome', operator: 'contains', value: '1' }] }} onChange={onChange} />);
  expect(screen.getByLabelText('染色体')).toHaveValue('custom');
});
