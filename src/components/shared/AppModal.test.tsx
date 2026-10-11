import * as React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AppModal, ConfirmDialog } from './AppModal';

it('uses the named shared close action and honors a hidden close control', () => {
  const change = vi.fn();
  const { rerender } = render(<AppModal open title="测试详情" onOpenChange={change}>内容</AppModal>);
  fireEvent.click(screen.getByRole('button', { name: '关闭弹窗' }));
  expect(change).toHaveBeenCalledWith(false);
  rerender(<AppModal open title="测试详情" showCloseButton={false} onOpenChange={change}>内容</AppModal>);
  expect(screen.queryByRole('button', { name: '关闭弹窗' })).not.toBeInTheDocument();
});

it('keeps an in-flight confirmation open and prevents duplicate confirmation', async () => {
  const confirm = vi.fn(() => new Promise<void>(() => {})), change = vi.fn();
  render(<ConfirmDialog open title="删除任务" message="测试记录" confirmLabel="确认删除" variant="danger" onOpenChange={change} onConfirm={confirm} />);
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  expect(confirm).toHaveBeenCalledOnce();
  const pending = screen.getByRole('button', { name: '处理中...' });
  expect(pending).toBeDisabled();
  fireEvent.click(pending);
  fireEvent.click(screen.getByRole('button', { name: '关闭弹窗' }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(change).not.toHaveBeenCalled();
});
