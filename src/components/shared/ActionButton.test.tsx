import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ActionButton, IconActionButton } from './ActionButton';
beforeEach(() => { vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 80, 20)); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('forwards refs and events, and blocks duplicate clicks while loading', () => {
  const ref = React.createRef<HTMLButtonElement>(), click = vi.fn();
  const { rerender } = render(<ActionButton ref={ref} action="save" onClick={click} loadingLabel="保存中">保存</ActionButton>);
  expect(ref.current).toBe(screen.getByRole('button', { name: '保存' }));
  fireEvent.click(ref.current!);
  expect(click).toHaveBeenCalledOnce();
  rerender(<ActionButton ref={ref} action="save" loading onClick={click} loadingLabel="保存中">保存</ActionButton>);
  expect(ref.current).toBeDisabled();
  expect(ref.current).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(ref.current!);
  expect(click).toHaveBeenCalledOnce();
  expect(ref.current!.querySelectorAll('svg')).toHaveLength(1);
  expect(ref.current!.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  // Both labels occupy the same grid in both states to reserve the maximum width.
  expect(ref.current!.querySelector('.yj-loading-label')?.children).toHaveLength(2);
});

it('defaults to a non-submitting button and accepts explicit submit', () => {
  const submit = vi.fn(event => event.preventDefault());
  render(<form onSubmit={submit}><ActionButton>取消</ActionButton><ActionButton type="submit">提交</ActionButton></form>);
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '提交' }));
  expect(submit).toHaveBeenCalledOnce();
});

it('gives icon actions names and focus hints with Escape dismissal', () => {
  render(<IconActionButton action="close" label="关闭详情" />);
  const button = screen.getByRole('button', { name: '关闭详情' });
  fireEvent.focus(button);
  expect(screen.getByRole('tooltip')).toHaveTextContent('关闭详情');
  expect(button).toHaveAccessibleDescription('关闭详情');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('exposes unavailable reasons on disabled icon hover without enabling the action', () => {
  vi.useFakeTimers();
  render(<IconActionButton action="ai" label="AI 生成" hint="引擎尚未开放" disabled />);
  const button = screen.getByRole('button', { name: 'AI 生成' });
  expect(button).toBeDisabled();
  fireEvent.mouseEnter(button.parentElement!);
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole('tooltip')).toHaveTextContent('引擎尚未开放');
  vi.useRealTimers();
});
