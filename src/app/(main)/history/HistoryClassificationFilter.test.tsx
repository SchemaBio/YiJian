import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { HistoryClassificationFilter } from './HistoryClassificationFilter';

it('selects missing classifications and closes the filter', () => {
  const change = vi.fn();
  function Harness() {
    const [value, setValue] = React.useState('VUS');
    return <HistoryClassificationFilter value={value} onChange={next => { setValue(next); change(next); }} />;
  }
  render(<Harness />);
  const trigger = screen.getByRole('button', { hidden: true, name: '当前分类筛选' });
  expect(trigger).toHaveTextContent('意义不明');
  fireEvent.click(trigger);
  expect(screen.getByRole('menuitemradio', { hidden: true, name: '意义不明' })).toHaveFocus();
  fireEvent.click(screen.getByRole('menuitemradio', { hidden: true, name: '未提供' }));
  expect(change).toHaveBeenCalledWith('__missing');
  expect(trigger).toHaveTextContent('未提供');

  expect(screen.queryByRole('menu', { hidden: true })).not.toBeInTheDocument();
});

it('supports arrow navigation and Escape without changing the filter', () => {
  const change = vi.fn();
  render(<HistoryClassificationFilter value="" onChange={change} />);
  const trigger = screen.getByRole('button', { hidden: true, name: '当前分类筛选' });
  fireEvent.click(trigger);
  const all = screen.getByRole('menuitemradio', { hidden: true, name: '全部分类' });
  expect(all).toHaveFocus();
  fireEvent.keyDown(all, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitemradio', { hidden: true, name: '未提供' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(screen.getByRole('menuitemradio', { hidden: true, name: '分类不一致' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('menu', { hidden: true })).not.toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
});
