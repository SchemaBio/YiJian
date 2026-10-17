import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PermissionEditor } from './PermissionEditor';
import { ActionButton } from './ActionButton';
import { BusinessPermissionContext, OperationScope } from '@/components/providers/BusinessPermissionProvider';

it('lists nine grants and supports select all, clear and administrator display', () => {
  const update = vi.fn();
  const { rerender } = render(<PermissionEditor administrator={false} values={['bed.manage']} onChange={update} />);
  expect(screen.getAllByRole('checkbox')).toHaveLength(9);
  expect(screen.getByRole('checkbox', { name: 'BED 文件管理' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: '全选' }));
  expect(update.mock.calls.at(-1)?.[0]).toHaveLength(9);
  fireEvent.click(screen.getByRole('button', { name: '清空' }));
  expect(update).toHaveBeenLastCalledWith([]);
  rerender(<PermissionEditor administrator values={[]} onChange={update} />);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.getByText('拥有全部权限')).toBeInTheDocument();
});
it('disables scoped writes with an accessible explanation, while preserving read actions', () => {
  render(<BusinessPermissionContext.Provider value={() => false}><OperationScope permission="samples.write">
    <ActionButton action="add">Create</ActionButton>
    <ActionButton action="refresh">Refresh</ActionButton>
    <ActionButton action="download">Download</ActionButton>
    <ActionButton permission={null} action="retry">Reload</ActionButton>
  </OperationScope></BusinessPermissionContext.Provider>);
  expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled();
  expect(screen.getByLabelText('无此操作权限，请联系平台管理员授权。')).toHaveAttribute('tabindex', '0');
});
it('requires both grants for a combined operation and supports nested baseline scopes', () => {
  render(<BusinessPermissionContext.Provider value={permission => permission === 'baselines.manage'}>
    <OperationScope permission="tasks.manage"><OperationScope permission="baselines.manage">
      <ActionButton action="start">Baseline</ActionButton>
      <ActionButton permission={['data.manage', 'samples.write']} action="edit">Link data</ActionButton>
    </OperationScope><ActionButton action="start">Ordinary task</ActionButton></OperationScope>
  </BusinessPermissionContext.Provider>);
  expect(screen.getByRole('button', { name: 'Baseline' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Ordinary task' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Link data' })).toBeDisabled();
});
