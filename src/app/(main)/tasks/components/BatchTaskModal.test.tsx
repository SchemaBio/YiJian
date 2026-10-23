import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { BatchTaskModal } from './BatchTaskModal';
import { tasksApi, type TaskBatchPreviewResponse } from '@/lib/tasks';
import { calculateEstimatedCredits, getBillingBalance, getBillingConfig } from '@/lib/billing';
const mode=vi.hoisted(()=>({backend:'octopus'}));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => mode.backend }));
vi.mock('@/lib/billing',()=>({calculateEstimatedCredits:vi.fn(()=>1),getBillingBalance:vi.fn(async()=>({balance:100})),getBillingConfig:vi.fn(async()=>({min_balance:0})),notifyBillingUpdated:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(calculateEstimatedCredits).mockReturnValue(1);mode.backend='octopus';});
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

it('keeps SaaS retention acknowledgement before batch submission',async()=>{
 mode.backend='squid';vi.mocked(tasksApi.previewBatch).mockResolvedValue(preview);
 render(<BatchTaskModal isOpen onClose={vi.fn()} onCompleted={vi.fn()}/>);
 upload(new File(['fixture'],'tasks.xlsx'));
 const create=await screen.findByRole('button',{name:'确认创建 1 个任务'});
 expect(create).toBeDisabled();expect(tasksApi.createBatch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('checkbox'));
 expect(create).toBeEnabled();
 expect(screen.queryByRole('link',{name:/下载/})).not.toBeInTheDocument();
});

it('quotes each VCF reservation as 50 credits in a mixed batch', async () => {
  mode.backend = 'squid';
  const actual = await vi.importActual<typeof import('@/lib/billing')>('@/lib/billing');
  vi.mocked(calculateEstimatedCredits).mockImplementation(actual.calculateEstimatedCredits);
  vi.mocked(getBillingBalance).mockResolvedValueOnce({ balance: 1000, org_id: 'org' });
  vi.mocked(getBillingConfig).mockResolvedValueOnce({ min_balance: 0, credits_per_minute: 1, credit_rate_multiplier: 2, download_credits: 1 });
  vi.mocked(tasksApi.previewBatch).mockResolvedValueOnce({ ...preview, total_rows: 3, valid_rows: 3, total_estimated_minutes: 110,
    rows: [
      { ...preview.rows[0], row_number: 2, template: 'vcf2anno', estimated_minutes: 25 },
      { ...preview.rows[0], row_number: 3, template: 'vcf2anno', estimated_minutes: 25 },
      { ...preview.rows[0], row_number: 4, template: 'single', estimated_minutes: 60 },
    ] });
  render(<BatchTaskModal isOpen onClose={vi.fn()} onCompleted={vi.fn()} />);
  upload(new File(['fixture'], 'mixed.xlsx'));
  expect(await screen.findByText(/220 积分/)).toBeInTheDocument();
});
