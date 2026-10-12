import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CNVPlotWindow } from './CNVPlotWindow';

it('opens below a high row and moves above a low row without covering either', () => {
  const props = { open: true, title: '避让所选行', onClose: vi.fn(), children: '图表' };
  const view = render(<CNVPlotWindow {...props} anchor={{ top: 100, bottom: 140, left: 80, right: 1000 }} />);
  const dialog = screen.getByRole('dialog', { name: '避让所选行' });
  expect(parseInt(dialog.style.top)).toBe(152);
  expect(dialog.style.maxHeight).toContain(`${window.innerHeight - 168}px`);
  view.rerender(<CNVPlotWindow {...props} anchor={{ top: 600, bottom: 640, left: 80, right: 1000 }} />);
  expect(parseInt(dialog.style.top)).toBe(16);
  expect(dialog.style.maxHeight).toContain('572px');
  expect(16 + 572).toBeLessThan(600);
});

it('moves the window by dragging its header', () => {
  const original = window.PointerEvent;
  window.PointerEvent = class extends MouseEvent { pointerId = 1; } as typeof PointerEvent;
  try {
    render(<CNVPlotWindow open title="可拖动图窗" onClose={vi.fn()}>图表</CNVPlotWindow>);
    const header = screen.getByLabelText('拖动图窗标题，或使用方向键移动');
    Object.defineProperty(header, 'setPointerCapture', { value: vi.fn() });
    const dialog = screen.getByRole('dialog', { name: '可拖动图窗' });
    const x = parseInt(dialog.style.left), y = parseInt(dialog.style.top);
    fireEvent.pointerDown(header, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(header, { clientX: 160, clientY: 140 });
    expect(parseInt(dialog.style.left)).toBe(x + 60);
    expect(parseInt(dialog.style.top)).toBe(y + 40);
    fireEvent.pointerUp(header);
  } finally { window.PointerEvent = original; }
});

it('does not close on Escape or outside clicks and supports keyboard movement', () => {
  const close = vi.fn();
  render(<CNVPlotWindow open title="区域信号" onClose={close}><p>图表内容</p></CNVPlotWindow>);
  const dialog = screen.getByRole('dialog', { name: '区域信号' });
  expect(dialog).toHaveAttribute('aria-modal', 'false');
  expect(document.querySelector('.yj-inspector-backdrop')).toBeNull();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  fireEvent.click(document.body);
  expect(close).not.toHaveBeenCalled();
  const header = screen.getByLabelText('拖动图窗标题，或使用方向键移动');
  const left = parseInt(dialog.style.left);
  fireEvent.keyDown(header, { key: 'ArrowRight' });
  expect(parseInt(dialog.style.left)).toBe(left + 20);
  fireEvent.click(screen.getByRole('button', { name: '关闭图窗' }));
  expect(close).toHaveBeenCalledTimes(1);
});
