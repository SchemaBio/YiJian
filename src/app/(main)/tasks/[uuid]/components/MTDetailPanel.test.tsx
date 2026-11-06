import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import type { MitochondrialVariant } from '../types';
import { MTDetailPanel } from './MTDetailPanel';

vi.mock('@/lib/api', async original => ({
  ...await original<typeof import('@/lib/api')>(),
  api: { post: vi.fn() },
}));

it('shows archived mitochondrial annotations and saves reviewer-selected mtDNA criteria', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const variant: MitochondrialVariant = {
    id: 'mt-row', position: 16304, ref: 'T', alt: 'C', gene: 'MT-DLOOP', hgvs: 'm.16304T>C',
    pathogenicity: 'Unknown', associatedDisease: '-', heteroplasmy: 0.4, depth: 100, altReadCounts: [40],
    pinned: false, reviewed: false, focused: false,
    annotationValues: { HGVS_c: 'n.16304T>C', ClinVar_DN: 'Reference condition', TLOD: 12.8 },
  };
  const evidence = [{ code: 'PM2', strength: 'supporting', note: 'Population reference checked' }];
  vi.mocked(api.post).mockResolvedValue({ classification: 'VUS', basis: 'insufficient', evidence });
  render(<MTDetailPanel taskId="task" variant={variant} isOpen onClose={vi.fn()} onSaveAssessment={save} />);
  expect(screen.getByText('m.16304T>C')).toBeVisible();
  expect(screen.getByText('Reference condition')).toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: '证据' }));
  expect(screen.getByText('12.8')).toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: 'ACMG' }));
  const pm2 = screen.getByRole('combobox', { name: 'PM2' });
  expect(pm2.querySelector('option[value="moderate"]')).toBeNull();
  fireEvent.change(pm2, { target: { value: 'supporting' } });
  fireEvent.change(screen.getByRole('textbox', { name: /PM2 证据依据/ }), { target: { value: 'Population reference checked' } });
  const saveButton = screen.getByRole('button', { name: '保存人工评定' });
  expect(saveButton).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '预览分类' }));
  expect(await screen.findByText(/预览分类 · VUS/)).toBeVisible();
  expect(api.post).toHaveBeenCalledWith('/v1/tasks/task/results/assessment/mt/preview', { evidence });
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(saveButton);
  await waitFor(() => expect(save).toHaveBeenCalledWith(variant, evidence));
});
