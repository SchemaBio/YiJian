import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BatchTaskModal } from './BatchTaskModal';
import { tasksApi, type TaskBatchPreviewResponse } from '@/lib/tasks';
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => 'octopus' }));
vi.mock('@/lib/tasks', () => ({ tasksApi: { previewBatch: vi.fn(), createBatch: vi.fn() } }));
const preview: TaskBatchPreviewResponse = { total_rows: 1, valid_rows: 1, invalid_rows: 0, total_estimated_minutes: 60, rows: [{ row_number: 2, sample_identifier: 'synthetic-sample', pedigree_id: '', pipeline_id: 'synthetic-pipeline', remark: '', enable_cnv: true, enable_sv: false, valid: true, errors: [], estimated_minutes: 60 }] };
function upload(file: File) { fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } }); }
it('rejects unsupported files before contacting the preview service', async () => {
  render(<BatchTaskModal isOpen onClose={vi.fn()} onCompleted={vi.fn()} />);
  upload(new File(['data'], 'synthetic.csv'));
  expect(await screen.findByRole('alert')).toHaveTextContent('仅支持 .xlsx');
  expect(tasksApi.previewBatch).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '确认创建' })).toBeDisabled();
});
it('blocks invalid rows and retains the validated preview after creation fails', async () => {
  vi.mocked(tasksApi.previewBatch).mockResolvedValueOnce({ ...preview, valid_rows: 0, invalid_rows: 1, rows: [{ ...preview.rows[0], valid: false, errors: ['样本不存在'] }] }).mockResolvedValueOnce(preview);
  vi.mocked(tasksApi.createBatch).mockRejectedValueOnce(new Error('创建失败，请重试'));
  render(<BatchTaskModal isOpen onClose={vi.fn()} onCompleted={vi.fn()} />);
  upload(new File(['fixture'], 'synthetic.xlsx'));
  await screen.findByText('样本不存在');
  expect(screen.getByRole('button', { name: '确认创建' })).toBeDisabled();
  upload(new File(['fixture'], 'corrected.xlsx'));
  const create = await screen.findByRole('button', { name: '确认创建 1 个任务' });
  fireEvent.click(create);
  expect(await screen.findByRole('alert')).toHaveTextContent('创建失败，请重试');
  expect(screen.getByText('corrected.xlsx')).toBeInTheDocument();
  expect(screen.getByText('synthetic-sample')).toBeInTheDocument();
  expect(create).toBeEnabled();
});
