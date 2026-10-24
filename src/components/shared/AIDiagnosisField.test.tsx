import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AIAssistanceAdapter } from '@/lib/ai-assistance';
import { AIAssistanceProvider } from '@/components/providers/AIAssistanceProvider';
import { AIDiagnosisField } from './AIDiagnosisField';
const { terms } = vi.hoisted(() => ({ terms: [{ id: 'HP:0001250', name: '癫痫发作' }, { id: 'HP:0002315', name: '头痛' }, { id: 'HP:0001252', name: '肌张力减退', nameEn: 'Hypotonia' }, { id: 'HP:0010547', name: '肌张力减退', nameEn: 'Muscle flaccidity' }] }));
vi.mock('@/lib/hpo-terms', () => ({ useHpoTerms: () => terms }));

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
    await waitFor(() => expect(receive).toHaveBeenCalledWith([{ id: 'HP:0001250', name: '癫痫发作' }]));
    expect(screen.getByRole('status')).toHaveTextContent('未收录的编号已忽略');
  });
});
