import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { HistoryColumnFilter } from './HistoryColumnFilter';

it('keeps arbitrary text and numeric filters editable without native datalist suggestions', () => {
  const change = vi.fn();
  render(<HistoryColumnFilter label="POS" value=">=100" numeric onChange={change} />);
  const input = screen.getByLabelText('POS筛选');
  expect(input).toHaveValue('>=100');
  expect(input).not.toHaveAttribute('list');
  fireEvent.change(input, { target: { value: '<200' } });
  expect(change).toHaveBeenCalledWith('<200');
});

it('selects presence without losing missing-value filter semantics', () => {
  const change = vi.fn();
  render(<HistoryColumnFilter label="REF" value="" onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'REF完整性筛选', hidden: true }));
  fireEvent.click(screen.getByRole('menuitemradio', { name: '未提供', hidden: true }));
  expect(change).toHaveBeenCalledWith('__missing');
  expect(screen.queryByRole('menu', { hidden: true })).not.toBeInTheDocument();
});
