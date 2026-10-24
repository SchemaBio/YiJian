import * as React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AIAssistanceAdapter } from '@/lib/ai-assistance';
import { AIAssistanceProvider } from '@/components/providers/AIAssistanceProvider';
import { LocaleProvider } from '@/components/providers/LocaleProvider';
import { AIDiagnosisField } from './AIDiagnosisField';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const { terms } = vi.hoisted(() => ({
  terms: [
    { id: 'HP:0001250', name: '癫痫发作', nameEn: 'Seizure' },
    { id: 'HP:0002315', name: '头痛', nameEn: 'Headache' },
    { id: 'HP:0001252', name: '肌张力减退', nameEn: 'Hypotonia' },
    { id: 'HP:0010547', name: '肌张力减退', nameEn: 'Muscle flaccidity' },
  ],
}));

vi.mock('@/lib/hpo-terms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hpo-terms')>();
  return {
    ...actual,
    useHpoTerms: () => terms,
  };
});

it('does not display the local description banner', async () => {
  render(<AIDiagnosisField value="癫痫发作" onChange={vi.fn()} onTerms={vi.fn()} />);
  await screen.findByRole('button', { name: /HP:0001250/ });
  expect(screen.queryByText(/仅在本机拆词匹配内置术语/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Segments text against bundled terms/)).not.toBeInTheDocument();
});

it('extracts locally without AI configuration or calls and only adds reviewed candidates', async () => {
  const onTerms = vi.fn(), generate = vi.fn();
  const adapter = { getSettings: vi.fn().mockResolvedValue({ enabled: false, connected: false, configured: false }), saveSettings: vi.fn(), generate };
  const { rerender } = render(<AIAssistanceProvider deployment="opensource" adapter={adapter}><AIDiagnosisField value="癫痫发作，无头痛" onChange={vi.fn()} onTerms={onTerms} /></AIAssistanceProvider>);
  const add = await screen.findByRole('button', { name: '添加本地候选（1）' });
  expect(generate).not.toHaveBeenCalled();
  expect(onTerms).not.toHaveBeenCalled();
  fireEvent.click(add);
  expect(onTerms).toHaveBeenCalledWith([{ id: 'HP:0001250', name: '癫痫发作' }]);
  rerender(<AIAssistanceProvider deployment="opensource" adapter={adapter}><AIDiagnosisField value="未知描述" onChange={vi.fn()} onTerms={onTerms} /></AIAssistanceProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: '添加本地候选（0）' })).toBeDisabled());
});

it('displays English HPO names when the active locale is not Simplified or Traditional Chinese', async () => {
  const onTerms = vi.fn();
  render(
    <LocaleProvider initialLocale="en">
      <AIDiagnosisField value="癫痫发作" onChange={vi.fn()} onTerms={onTerms} />
    </LocaleProvider>
  );
  const choice = await screen.findByRole('button', { name: 'Seizure · HP:0001250' });
  expect(choice).toBeInTheDocument();
  fireEvent.click(choice);
  expect(onTerms).toHaveBeenCalledWith([{ id: 'HP:0001250', name: 'Seizure' }]);
});

it('calls the AI adapter only when AI-assisted extraction is clicked', async () => {
  const onTerms = vi.fn();
  const generate = vi.fn().mockResolvedValue({ feature: 'hpo', summary: 'AI', hpoTerms: [{ id: 'HP:0002315', name: 'Headache', polarity: 'present' }] });
  const adapter = { getSettings: vi.fn().mockResolvedValue({ enabled: true, connected: true, configured: true, capabilities: { hpo: { enabled: true, mode: 'candidate' } } }), saveSettings: vi.fn(), generate };
  render(<AIAssistanceProvider deployment="opensource" adapter={adapter}><AIDiagnosisField value="头痛" onChange={vi.fn()} onTerms={onTerms} /></AIAssistanceProvider>);
  const button = screen.getByRole('button', { name: 'AI 生成HPO 候选术语' });
  await waitFor(() => expect(button).toBeEnabled());
  expect(generate).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(generate).toHaveBeenCalledWith(expect.objectContaining({ feature: 'hpo', diagnosis: '头痛' }), expect.anything()));
  const candidate = await within(screen.getByRole('region', { name: 'AI 辅助提取 HPO' })).findByRole('button', { name: '头痛 · HP:0002315' });
  expect(within(screen.getByRole('region', { name: 'AI 辅助提取 HPO' })).queryByRole('checkbox')).not.toBeInTheDocument();
  expect(onTerms).not.toHaveBeenCalled();
  fireEvent.click(candidate);
  await waitFor(() => expect(onTerms).toHaveBeenCalledWith([{ id: 'HP:0002315', name: '头痛' }]));
});

it('requires an explicit choice for ambiguous translations instead of bulk adding both IDs', async () => {
  const onTerms = vi.fn();
  render(<AIDiagnosisField value="肌张力减退" onChange={vi.fn()} onTerms={onTerms} />);
  const choice = await screen.findByRole('button', { name: '肌张力减退 (Hypotonia) · HP:0001252' });
  expect(screen.getByRole('button', { name: '添加本地候选（0）' })).toBeDisabled();
  expect(onTerms).not.toHaveBeenCalled();
  fireEvent.click(choice);
  expect(onTerms).toHaveBeenCalledWith([{ id: 'HP:0001252', name: '肌张力减退' }]);
});

describe('AI HPO generation', () => {
  it('validates IDs against the ontology and replaces model names with canonical labels', async () => {
    const client: AIAssistanceAdapter = { getSettings: vi.fn().mockResolvedValue({ enabled: true, connected: true, configured: true }), saveSettings: vi.fn(),
      generate: vi.fn().mockResolvedValue({ feature: 'hpo', summary: '提取表型', hpoTerms: [{ id: 'HP:0001250', name: '错误名称' }, { id: 'HP:0001250', name: '重复名称' }, { id: 'HP:9999999', name: '未收录术语' }] }) };
    const receive = vi.fn();
    render(<AIAssistanceProvider deployment="opensource" adapter={client}><AIDiagnosisField value="癫痫" onChange={vi.fn()} onTerms={receive} /></AIAssistanceProvider>);
    const button = screen.getByRole('button', { name: 'AI 生成HPO 候选术语' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    const candidate = await within(screen.getByRole('region', { name: 'AI 辅助提取 HPO' })).findByRole('button', { name: '癫痫发作 · HP:0001250' });
    expect(receive).not.toHaveBeenCalled();
    expect(within(screen.getByRole('region', { name: 'AI 辅助提取 HPO' })).queryByRole('button', { name: /HP:9999999/ })).not.toBeInTheDocument();
    expect(screen.getByText(/未收录的编号已忽略/)).toBeInTheDocument();
    fireEvent.click(candidate);
      await waitFor(() => expect(receive).toHaveBeenCalledWith([{ id: 'HP:0001250', name: '癫痫发作' }]));
  });
});

it('lets users confirm a subset and clears pending candidates when the phenotype changes', async () => {
  const onTerms = vi.fn();
  const client: AIAssistanceAdapter = { getSettings: vi.fn().mockResolvedValue({ enabled: true, connected: true, configured: true }), saveSettings: vi.fn(), generate: vi.fn().mockResolvedValue({ feature: 'hpo', summary: 'AI', hpoTerms: [{ id: 'HP:0001250', name: 'Seizure' }, { id: 'HP:0002315', name: 'Headache' }] }) };
  const renderField = (value: string) => <AIAssistanceProvider deployment="opensource" adapter={client}><AIDiagnosisField value={value} onChange={vi.fn()} onTerms={onTerms} /></AIAssistanceProvider>;
  const { rerender } = render(renderField('研究背景描述'));
  const generate = screen.getByRole('button', { name: 'AI 生成HPO 候选术语' });
  await waitFor(() => expect(generate).toBeEnabled());
  fireEvent.click(generate);
  const seizure = await within(screen.getByRole('region', { name: 'AI 辅助提取 HPO' })).findByRole('button', { name: '癫痫发作 · HP:0001250' });
  expect(onTerms).not.toHaveBeenCalled();
  expect(within(screen.getByRole('region', { name: 'AI 辅助提取 HPO' })).queryByRole('checkbox')).not.toBeInTheDocument();
  fireEvent.click(seizure);
  expect(onTerms).toHaveBeenCalledTimes(1);
  expect(onTerms).toHaveBeenCalledWith([{ id: 'HP:0001250', name: '癫痫发作' }]);
  expect(within(screen.getByRole('region', { name: 'AI 辅助提取 HPO' })).getByRole('button', { name: '头痛 · HP:0002315' })).toBeInTheDocument();
  rerender(renderField('新的研究背景描述'));
  expect(within(screen.getByRole('region', { name: 'AI 辅助提取 HPO' })).queryByRole('button', { name: '头痛 · HP:0002315' })).not.toBeInTheDocument();
  expect(onTerms).toHaveBeenCalledTimes(1);
});

it('restores saved candidates after reopening without generating or automatically adding terms', async () => {
  const generate = vi.fn();
  const getSavedHPO = vi.fn().mockResolvedValue({ feature: 'hpo', summary: 'saved', hpoTerms: [{ id: 'HP:0001250', name: 'Seizure' }] });
  const client = { getSettings: vi.fn().mockResolvedValue({ enabled: false, connected: false, configured: false }), saveSettings: vi.fn(), getSavedHPO, generate };
  const onTerms = vi.fn();
  const field = () => <AIAssistanceProvider deployment="opensource" adapter={client}><AIDiagnosisField value="已保存的表型描述" onChange={vi.fn()} onTerms={onTerms} /></AIAssistanceProvider>;
  const first = render(field());
  let region = within(screen.getByRole('region', { name: 'AI 辅助提取 HPO' }));
  const candidate = await region.findByRole('button', { name: '癫痫发作 · HP:0001250' });
  expect(generate).not.toHaveBeenCalled();
  expect(onTerms).not.toHaveBeenCalled();
  fireEvent.click(candidate);
  expect(candidate).toBeInTheDocument();
  first.unmount();
  render(field());
  region = within(screen.getByRole('region', { name: 'AI 辅助提取 HPO' }));
  await region.findByRole('button', { name: '癫痫发作 · HP:0001250' });
  expect(getSavedHPO).toHaveBeenCalledTimes(2);
  expect(generate).not.toHaveBeenCalled();
  expect(onTerms).toHaveBeenCalledTimes(1);
});
