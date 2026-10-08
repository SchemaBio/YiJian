import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HoverHint } from './HoverHint';

beforeEach(() => { vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 80, 20)); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('preserves focus and click behavior and dismisses the accessible hint with Escape', () => {
  const click = vi.fn(), focus = vi.fn();
  render(<HoverHint content="编辑内部编号"><button onClick={click} onFocus={focus}>编辑</button></HoverHint>);
  const button = screen.getByRole('button', { name: '编辑内部编号' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.focus(button);
  expect(focus).toHaveBeenCalledOnce();
  expect(button).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.click(button);
  expect(click).toHaveBeenCalledOnce();
});

it('cancels a pending hover and closes a visible hint on scroll', () => {
  vi.useFakeTimers();
  render(<HoverHint content="完整批次"><span>批次</span></HoverHint>);
  const target = screen.getByText('批次');
  fireEvent.mouseEnter(target);
  fireEvent.mouseLeave(target);
  act(() => vi.advanceTimersByTime(250));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.mouseEnter(target);
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole('tooltip')).toHaveTextContent('完整批次');
  fireEvent.scroll(window);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('creates no tooltip surfaces for a page of idle targets', () => {
  render(<>{Array.from({ length: 200 }, (_, i) => <HoverHint key={i} content={`注释 ${i}`}><span>{i}</span></HoverHint>)}</>);
  expect(screen.queryAllByRole('tooltip')).toHaveLength(0);
  expect(document.querySelectorAll('[aria-describedby]')).toHaveLength(0);
});

it('keeps a focused hint visible when the pointer subsequently enters the same target', () => {
  vi.useFakeTimers();
  render(<HoverHint content="详情"><button>查看</button></HoverHint>);
  const target = screen.getByRole('button', {name:'详情'});
  fireEvent.focus(target);
  fireEvent.mouseEnter(target);
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole('tooltip')).toHaveStyle({visibility:'visible'});
});
