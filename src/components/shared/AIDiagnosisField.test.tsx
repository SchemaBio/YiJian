import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AIAssistanceProvider } from '@/components/providers/AIAssistanceProvider';
import type { AIAssistanceAdapter } from '@/lib/ai-assistance';
import { AIDiagnosisField } from './AIDiagnosisField';
vi.mock('@/lib/hpo-terms', () => ({ useHpoTerms: () => [{ id: 'HP:0001250', name: '癫痫发作' }] }));

describe('AI HPO generation', () => {
  it('validates IDs against the ontology and replaces model names with canonical labels', async () => {
    const client: AIAssistanceAdapter = { getSettings: vi.fn().mockResolvedValue({ enabled: true, connected: true, configured: true }), saveSettings: vi.fn(),
      generate: vi.fn().mockResolvedValue({ feature: 'hpo', summary: '提取表型', hpoTerms: [{ id: 'HP:0001250', name: '错误名称' }, { id: 'HP:0001250', name: '重复名称' }, { id: 'HP:9999999', name: '未收录术语' }] }) };
    const receive = vi.fn();
    render(<AIAssistanceProvider deployment="opensource" adapter={client}><AIDiagnosisField value="癫痫" onChange={vi.fn()} onTerms={receive} /></AIAssistanceProvider>);
    const button = screen.getByRole('button', { name: 'AI 生成HPO 表型术语' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(receive).toHaveBeenCalledWith([{ id: 'HP:0001250', name: '癫痫发作' }]));
    expect(screen.getByRole('status')).toHaveTextContent('未收录的编号已忽略');
  });
});
