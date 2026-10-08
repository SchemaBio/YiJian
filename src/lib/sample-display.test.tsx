import * as React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { normalizeSampleDetail as normalizeSample } from './samples';
import { normalizeSampleDetail as normalizeTaskSample } from './task-resources';
import { getSampleQualityDisplay, getFamilyHistoryLabel, formatTurnaroundDays } from './sample-display';
import { SampleInfoTab } from '@/app/(main)/samples/[uuid]/components/SampleInfoTab';
import { SampleSummaryCard } from '@/app/(main)/tasks/[uuid]/components/SampleSummaryCard';

vi.mock('@/components/shared/ToolbarPopover', () => ({
  ToolbarPopover: ({ label, children }: any) => <section><h3>{label}</h3>{children}</section>,
}));
afterEach(cleanup);
const normalizers = [normalizeSample, normalizeTaskSample];
it.each(normalizers)('preserves missing metadata as unknown (%#)', normalize => {
  const sample = normalize({ id: 'sample-1' });
  expect(sample.submissionInfo.sampleQuality).toBeUndefined();
  expect(sample.projectInfo.turnaroundDays).toBeUndefined();
  expect(sample.projectInfo.priority).toBeUndefined();
  expect(sample.familyHistory.hasHistory).toBeUndefined();
});
it.each(normalizers)('preserves explicitly supplied quality, zero days, normal priority and no history (%#)', normalize => {
  const sample = normalize({ id: 'sample-1', submissionInfo: { sampleQuality: 'acceptable' },
    projectInfo: { turnaroundDays: 0, priority: 'normal' }, familyHistory: { hasHistory: false } });
  expect(sample.submissionInfo.sampleQuality).toBe('acceptable');
  expect(sample.projectInfo.turnaroundDays).toBe(0);
  expect(sample.projectInfo.priority).toBe('normal');
  expect(sample.familyHistory.hasHistory).toBe(false);
});
it('does not present unknown or invalid data as a clinical conclusion', () => {
  expect(getSampleQualityDisplay(undefined)).toEqual({ label: '未提供', variant: 'neutral' });
  expect(getSampleQualityDisplay('invalid').variant).toBe('neutral');
  expect(getFamilyHistoryLabel(undefined)).toBe('未提供');
  expect(getFamilyHistoryLabel(false)).toBe('无');
  expect(formatTurnaroundDays(undefined)).toBe('—');
  expect(formatTurnaroundDays(Infinity)).toBe('—');
  expect(formatTurnaroundDays(0)).toBe('0天');
});
it('shows unknown fields in sample details without inventing quality or duration', () => {
  render(<SampleInfoTab sample={normalizeSample({ id: 'sample-1' })} />);
  expect(screen.queryByText('合格')).not.toBeInTheDocument();
  expect(screen.queryByText('普通')).not.toBeInTheDocument();
  expect(screen.queryByText('0天')).not.toBeInTheDocument();
  expect(screen.getAllByText('未提供')).toHaveLength(2);
});
it('keeps unknown sample data neutral inside the workspace popover', async () => {
  render(<SampleSummaryCard sample={normalizeTaskSample({ id: 'sample-1' })} />);
  await screen.findByRole('heading', { name: '样本详情' });
  expect(screen.queryByText('合格')).not.toBeInTheDocument();
  expect(screen.queryByText('0天')).not.toBeInTheDocument();
  expect(screen.queryByText('无')).not.toBeInTheDocument();
  expect(screen.queryByText('检测Panel:')).not.toBeInTheDocument();
});
