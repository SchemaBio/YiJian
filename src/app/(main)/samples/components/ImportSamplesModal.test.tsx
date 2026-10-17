vi.mock('@/lib/import-workbook', async original => ({
 ...await original<typeof import('@/lib/import-workbook')>(),
 readImportWorkbook: async (file: File) => {
  const {parseCSVRecords} = await import('@/lib/sample-import');
  return parseCSVRecords(await file.text());
 },
}));
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ImportSamplesModal } from './ImportSamplesModal';
import { api } from '@/lib/api';
import { BusinessPermissionContext } from '@/components/providers/BusinessPermissionProvider';
vi.mock('@/lib/api', async importOriginal => ({...await importOriginal<typeof import('@/lib/api')>(), api: { post: vi.fn() } }));
const header = 'Sample ID,Internal ID,Sex,Sample type,Batch,Clinical diagnosis\n';
const file = (text: string) => Object.assign(new File([text], 'samples.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), { text: async () => text });
beforeEach(() => vi.clearAllMocks());
it('previews and retries failures without duplicating successful rows', async () => {
  const imported = vi.fn(); let failures = 0;
  vi.mocked(api.post).mockImplementation(async (_path, body) => {
    const value = body as { internal_id: string };
    if (value.internal_id === 'I2' && failures++ === 0) throw new Error('temporary failure');
    return { id: value.internal_id };
  });
  render(<ImportSamplesModal onClose={() => {}} onImported={imported} />);
  fireEvent.change(screen.getByLabelText('选择样本 XLSX 文件'), { target: { files: [file(header + 'S1,I1,male,DNA,B,x\nS2,I2,female,DNA,B,y')] } });
  await screen.findByText('I2'); expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '开始导入 / 重试失败行' }));
  await screen.findByText('temporary failure');
  await waitFor(() => expect(imported).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: '开始导入 / 重试失败行' }));
  await waitFor(() => expect(imported).toHaveBeenCalledTimes(2));
  expect(api.post).toHaveBeenCalledTimes(3);
  expect(vi.mocked(api.post).mock.calls.filter(([, body]) => (body as { internal_id: string }).internal_id === 'I1')).toHaveLength(1);
  expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('identity_policy_acknowledged', true);
  expect(screen.getByRole('button', { name: '开始导入 / 重试失败行' })).toBeDisabled();
});
it('blocks unauthorized writes', () => {
  render(<BusinessPermissionContext.Provider value={() => false}><ImportSamplesModal onClose={() => {}} onImported={() => {}} /></BusinessPermissionContext.Provider>);
  expect(screen.getByRole('button', { name: '开始导入 / 重试失败行' })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
});
it('requires corrections before importing any rows', async () => {
  render(<ImportSamplesModal onClose={() => {}} onImported={() => {}} />);
  fireEvent.change(screen.getByLabelText('选择样本 XLSX 文件'), { target: { files: [file(header + 'S1,I1,male,DNA,B,x\nS2,I1,male,DNA,B,y')] } });
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: '开始导入 / 重试失败行' })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
});
