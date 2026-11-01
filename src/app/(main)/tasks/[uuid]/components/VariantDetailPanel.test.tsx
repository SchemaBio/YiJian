import * as React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VariantDetailPanel } from './VariantDetailPanel';
import type { SNVIndel } from '../types';
import { AIAssistanceProvider } from '@/components/providers/AIAssistanceProvider';
import type { AIAssistanceAdapter } from '@/lib/ai-assistance';

vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('../result-api', async importOriginal => ({
  ...await importOriginal<typeof import('../result-api')>(),
  getResultRowAdjustmentHistory: vi.fn().mockResolvedValue([]),
}));

const variant = (id: string) => ({
  id, gene: id, chromosome: '1', position: 100,
  ref: 'A', alt: 'G', variantType: 'SNV', zygosity: 'Heterozygous', pinned: false, reviewed: false, alleleFrequency: 0.5, depth: 100,
  transcript: 'NM_001000', hgvsc: 'c.1A>G', hgvsp: 'p.(Lys1Arg)', consequence: 'missense_variant',
  focused: false, interpretation: '', acmgCriteria: [], annotationValues: {},
}) as SNVIndel;

describe('same-screen interpretation', () => {
  it('directly saves manual ACMG evidence in ACMG tab', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const row = { ...variant('A') } as SNVIndel;
    render(<VariantDetailPanel taskId="task" variant={row} isOpen onClose={vi.fn()} onSaveVersionedAssessment={save} />);
    fireEvent.click(screen.getByRole('tab', { name: 'ACMG' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '选择 ACMG 证据 PP3' }));
    const button = screen.getByRole('button', { name: '确认保存' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'A' }),
      expect.objectContaining({
        acmgEvidence: [expect.objectContaining({ code: 'PP3' })],
        activeAcmgVersion: 'legacy',
        adoptedACMG: expect.objectContaining({ source: 'manual' }),
      }),
      expect.any(String)
    ));
  });

  it.each([['确认保存', true], ['仅保存本版', false]] as const)('atomically saves ACMG evidence with %s', async (button, adopt) => {
    const save = vi.fn().mockResolvedValue(undefined);
    const row = { ...variant('A'), acmgEvidence: [{ code: 'PP3', strength: 'supporting', source: 'manual' }] } as SNVIndel;
    render(<VariantDetailPanel taskId="task" variant={row} isOpen onClose={vi.fn()} onSaveVersionedAssessment={save} />);
    fireEvent.click(screen.getByRole('tab', { name: 'ACMG' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '选择 ACMG 证据 PM2' }));
    fireEvent.click(screen.getByRole('button', { name: button }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const changes = save.mock.calls[0][1];
    expect(changes.acmgEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PP3' }),
      expect.objectContaining({ code: 'PM2' }),
    ]));
    expect(changes.activeAcmgVersion).toBe(adopt ? 'legacy' : undefined);
  });

  it('shows error message when saving ACMG evidence fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Concurrent save conflict'));
    const row = { ...variant('A') } as SNVIndel;
    render(<VariantDetailPanel taskId="task" variant={row} isOpen onClose={vi.fn()} onSaveVersionedAssessment={save} />);
    fireEvent.click(screen.getByRole('tab', { name: 'ACMG' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '选择 ACMG 证据 PP3' }));
    fireEvent.click(screen.getByRole('button', { name: '仅保存本版' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Concurrent save conflict');
    expect(screen.getByRole('checkbox', { name: '选择 ACMG 证据 PP3' })).toBeChecked();
  });

  it('generates AI recommendations in AI tab and automatically saves without requiring manual review', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const client: AIAssistanceAdapter = {
      getSettings: vi.fn().mockResolvedValue({ enabled: true, configured: true, connected: true, capabilities: { acmg: { enabled: true } } }),
      saveSettings: vi.fn(),
      generate: vi.fn().mockResolvedValue({
        feature: 'acmg',
        requestId: 'ai-request-review',
        model: 'synthetic',
        summary: '合成 AI 建议',
        resultKind: 'evidence_only',
        classification: 'insufficient_data',
        suggestedClassification: 'Pathogenic',
        evidence: [
          { code: 'PM2', status: 'met', strength: 'Moderate', reason: '频率需人工核验' },
          { code: 'PVS1', status: 'not_applicable', strength: 'VeryStrong', reason: '机制未确认' },
          { code: 'PP3', status: 'insufficient_data', strength: 'Supporting', reason: '证据不足待补充' },
        ],
      }),
    };
    const initial = { ...variant('A') } as SNVIndel;
    render(
      <AIAssistanceProvider deployment="opensource" adapter={client}>
        <VariantDetailPanel taskId="task" referenceGenome="hg38" variant={initial} isOpen onClose={vi.fn()} onSaveVersionedAssessment={save} />
      </AIAssistanceProvider>
    );
    fireEvent.click(screen.getByRole('tab', { name: 'AI评估' }));
    const generate = screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' });
    await waitFor(() => expect(generate).toBeEnabled());
    fireEvent.click(generate);

    // AI 生成完成后自动保存，无需审核弹窗或复核勾选
    await waitFor(() => expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'A' }),
      expect.objectContaining({
        acmgAIResult: expect.objectContaining({
          requestId: 'ai-request-review',
          suggestedClassification: 'Pathogenic',
        }),
      }),
      'AI评估自动保存'
    ));

    expect(await screen.findByText('AI评定证据与结论')).toBeVisible();
    expect(screen.getByText('AI 研究候选建议')).toBeVisible();

    // 验证结论排在候选建议前面
    const conclusion = screen.getByText('AI评定证据与结论');
    const research = screen.getByText('AI 研究候选建议');
    expect(conclusion.compareDocumentPosition(research) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(await screen.findByText('合成 AI 建议')).toBeVisible();
    expect(screen.getAllByText('PM2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('频率需人工核验').length).toBeGreaterThan(0);
    expect(screen.queryByRole('checkbox', { name: '我已逐条复核候选证据、强度及适用性' })).not.toBeInTheDocument();

    // 验证 AI 评估结果同步至评估总览的 AI 证据建议卡片（同步结论与证据登记项）
    fireEvent.click(screen.getByRole('tab', { name: '评估总览' }));
    expect(screen.getByText('AI 证据建议')).toBeVisible();
    expect(screen.getAllByText('Pathogenic').length).toBeGreaterThan(0);
    expect(screen.getByText('依据: PM2')).toBeVisible();
  });

  it('requests SepiLens AI in AI tab and shows result in AIResultCard', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const client: AIAssistanceAdapter = {
      getSettings: vi.fn().mockResolvedValue({ enabled: true, configured: true, connected: true, capabilities: { acmg: { enabled: true } } }),
      saveSettings: vi.fn(),
      getClinicalContext: vi.fn().mockResolvedValue({ sampleType: 'blood', hpoTerms: ['HP:0001250'] }),
      generate: vi.fn().mockResolvedValue({
        feature: 'acmg',
        requestId: 'req-123',
        summary: '合成测试结果',
        resultKind: 'evidence_only',
        suggestedClassification: 'VUS',
        evidence: [{ code: 'PM2', status: 'insufficient_data', strength: 'Supporting', reason: '覆盖度待核验' }],
      }),
    };
    const panel = (id: string) => (
      <AIAssistanceProvider deployment="opensource" adapter={client}>
        <VariantDetailPanel taskId="task" referenceGenome="hg38" variant={variant(id)} isOpen onClose={vi.fn()} onSaveVersionedAssessment={save} />
      </AIAssistanceProvider>
    );
    const view = render(panel('A'));
    fireEvent.click(screen.getByRole('tab', { name: 'AI评估' }));
    const generate = screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' });
    await waitFor(() => expect(generate).toBeEnabled());
    fireEvent.click(generate);

    await waitFor(() => expect(client.generate).toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'acmg', taskId: 'task', reference: 'hg38', variant: expect.objectContaining({ gene: 'A', position: 100 }) }),
      expect.anything()
    ));

    expect((await screen.findAllByText('覆盖度待核验')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Supporting').length).toBeGreaterThan(0);
    view.rerender(panel('B'));
    expect(screen.queryByText('合成测试结果')).not.toBeInTheDocument();
  });

  it('derives ClinVar stars from review status even when the imported star is missing or stale', () => {
    const props = { taskId: 'task', isOpen: true, onClose: vi.fn() };
    const { rerender } = render(<VariantDetailPanel {...props} variant={{ ...variant('A'), clinvarStars: '.', annotationValues: { ClinVar_RevStat: 'reviewed_by_expert_panel' } }} />);
    expect(screen.getByText('审核星级').parentElement).toHaveTextContent('3');
    rerender(<VariantDetailPanel {...props} variant={{ ...variant('A'), clinvarStars: '4', annotationValues: { ClinVar_RevStat: 'criteria_provided,_single_submitter' } }} />);
    expect(screen.getByText('审核星级').parentElement).toHaveTextContent('1');
    rerender(<VariantDetailPanel {...props} variant={{ ...variant('A'), clinvarStars: '4', annotationValues: { ClinVar_RevStat: '.' } }} />);
    expect(screen.getByText('审核星级').parentElement).toHaveTextContent('-');
  });

  it('saves changed ACMG evidence and a manual classification with both reasons empty', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<VariantDetailPanel taskId="task" variant={variant('A')} isOpen onClose={vi.fn()} onUpdateClassification={save} />);
    fireEvent.click(screen.getByRole('tab', { name: 'ACMG' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '选择 ACMG 证据 PP3' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'PP3 理由与来源（可附文献链接）' }), { target: { value: 'Manual evidence with a public source' } });
    const override = screen.getByRole('option', { name: '按证据积分显示' }).parentElement!;
    fireEvent.change(override, { target: { value: 'Pathogenic' } });
    expect(screen.getByPlaceholderText('人工覆写理由（选填）')).toHaveValue('');
    expect(screen.getByPlaceholderText('本次证据调整理由（选填）')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: '确认保存' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'A' }),
      [expect.objectContaining({ code: 'PP3', note: 'Manual evidence with a public source' })],
      'Pathogenic',
      '',
      '',
      false
    ));
  });

  it('links each dbSNP identifier in the annotation tab and rejects non-rs values', () => {
    render(<VariantDetailPanel taskId="task" variant={{ ...variant('A'), rsId: 'rs671;RS123', annotationValues: { dbSNP: 'rs671&rs456&invalid' } }} isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '注释' }));
    const identifiers = screen.getByRole('heading', { name: '变异标识' }).parentElement!;
    for (const id of ['rs671', 'rs123', 'rs456']) {
      const link = within(identifiers).getByRole('link', { name: id });
      expect(link).toHaveAttribute('href', `https://www.ncbi.nlm.nih.gov/snp/${id}`);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(within(identifiers).queryByRole('link', { name: 'invalid' })).not.toBeInTheDocument();
  });

  it('shows transcript location, totals and HGVS in annotation', async () => {
    render(<VariantDetailPanel taskId="task" variant={{ ...variant('A'), annotationValues: { Location: 'Exon 2/20' } }} isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '注释' }));
    const section = screen.getByRole('heading', { name: '转录本与 HGVS' }).closest('section')!;
    await waitFor(() => expect(within(section).getByText('NM_001000')).toBeVisible());
    expect(within(section).getByText('20')).toBeVisible();
    expect(within(section).getByText('19（按外显子总数推算）')).toBeVisible();
    expect(within(section).getByText('c.1A>G')).toBeVisible();
    expect(within(section).getByText('p.(Lys1Arg)')).toBeVisible();
  });

  it('labels the quick result and its source without presenting it as ACMG points in overview', async () => {
    render(<VariantDetailPanel taskId="task" variant={{ ...variant('A'), acmgClassification: 'Benign', acmgAssessmentSource: 'automatic', automaticAcmg: { profile: 'fast', state: 'evaluated', score: 0, classification: 'Benign', classificationBasis: 'clinvar_reference', criteria: [], pending: [], screeningNotes: ['ClinVar：Benign；专家组审核', 'gnomAD：总体 AF=0.2；常见'] } }} isOpen onClose={vi.fn()} />);
    expect(screen.getAllByText('本地快速初评').length).toBeGreaterThan(0);
    expect(screen.getByText(/ClinVar：Benign/)).toBeVisible();
  });

  it('clears interpretation without a reason', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<VariantDetailPanel taskId="task" variant={{ ...variant('A'), interpretation: '旧解读' }} isOpen onClose={vi.fn()} onSaveInterpretation={save} />);
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    fireEvent.change(screen.getByPlaceholderText('请输入您对该变异的解读分析...'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '保存人工解读' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'A' }), '', ''));
  });

  it('browses tabs and adopts assessment via overview without entering a reason', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const assessed = { ...variant('A') } as SNVIndel;
    render(<VariantDetailPanel taskId="task" variant={assessed} isOpen onClose={vi.fn()} onSaveVersionedAssessment={save} />);
    expect(within(screen.getByRole('tablist', { name: '详情内容' })).getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      '评估总览', '注释', '证据', 'AI评估', 'ACMG', '人工解读', '变更记录'
    ]);
    fireEvent.click(screen.getByRole('button', { name: /人工评估/ }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(
      assessed,
      expect.objectContaining({ adoptedACMG: expect.objectContaining({ source: 'manual' }) }),
      expect.any(String)
    ));
  });

  it('restores manual interpretation without embedded ACMG calculator and without draft generator', () => {
    render(<VariantDetailPanel taskId="task" variant={variant('A')} isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    const textarea = screen.getByPlaceholderText('请输入您对该变异的解读分析...');
    expect(textarea).toBeVisible();
    expect(textarea.className).toContain('min-h-[260px]');
    expect(screen.queryByText('生成标准解读词')).not.toBeInTheDocument();
    expect(screen.queryByText('与评估总览实时联动')).not.toBeInTheDocument();
  });

  it('shows AI entry in AI tab and disables button when AI service is unavailable', async () => {
    render(<VariantDetailPanel taskId="task" variant={variant('A')} isOpen onClose={vi.fn()} />);
    // AI 标签有 AI 入口
    fireEvent.click(screen.getByRole('tab', { name: 'AI评估' }));
    expect(screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' })).toBeDisabled();

    // ACMG 标签没有 AI 入口
    fireEvent.click(screen.getByRole('tab', { name: 'ACMG' }));
    expect(screen.queryByRole('button', { name: 'AI 生成ACMG 现版建议' })).not.toBeInTheDocument();
  });

  it('retains an interpretation draft when visiting evidence and returning', async () => {
    render(<VariantDetailPanel taskId="task" variant={variant('A')} isOpen onClose={vi.fn()} onSaveInterpretation={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    const editor = screen.getByPlaceholderText('请输入您对该变异的解读分析...');
    fireEvent.change(editor, { target: { value: '待复核的解读' } });
    fireEvent.click(screen.getByRole('tab', { name: '证据' }));
    expect(editor).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    expect(editor).toBeVisible();
    expect(editor).toHaveValue('待复核的解读');
    fireEvent.click(screen.getByRole('tab', { name: '变更记录' }));
    await waitFor(() => expect(screen.getByText('暂无调整记录')).toBeVisible());
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    expect(editor).toHaveValue('待复核的解读');
  });

  it('opens on assessment overview, keeps annotations and puts GenCC before resource links and keeps only the header close control', async () => {
    const annotated = { ...variant('BRCA1'), annotationValues: { GenCC_disease_title: '示例疾病关联', GenCC_moi_title: '常染色体显性', GenCC_disease_original_curie: 'OMIM:123456' } };
    render(<VariantDetailPanel taskId="task" variant={annotated} isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '注释' }));
    expect(screen.queryByRole('tab', { name: '概览' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '注释' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('示例疾病关联')).toBeVisible();
    const headings = screen.getAllByRole('heading').map(item => item.textContent);
    expect(headings.indexOf('GenCC · 基因与疾病关联')).toBeLessThan(headings.indexOf('数据库与判读资源'));
    expect(screen.getAllByRole('button', { name: /^关闭$/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '在 IGV 中查看' })).not.toBeInTheDocument();
    expect(screen.getByText('判读变更记录')).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: '变更记录' }));
    await waitFor(() => expect(screen.getByText('判读变更记录')).toBeVisible());
  });

  it('saves without a reason and does not clear another variant’s draft when an earlier save completes', async () => {
    let finish!: () => void;
    const save = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const props = { taskId: 'task', isOpen: true, onClose: vi.fn(), onSaveInterpretation: save };
    const { rerender } = render(<VariantDetailPanel {...props} variant={variant('A')} />);
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    fireEvent.change(screen.getByPlaceholderText('请输入您对该变异的解读分析...'), { target: { value: 'A 解读' } });
    expect(screen.queryByPlaceholderText('本次调整理由（保存时必填）')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存人工解读' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'A' }), 'A 解读', '');
    rerender(<VariantDetailPanel {...props} variant={variant('B')} />);
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    const editor = screen.getByPlaceholderText('请输入您对该变异的解读分析...');
    fireEvent.change(editor, { target: { value: 'B 解读' } });
    finish();
    await waitFor(() => expect(editor).toHaveValue('B 解读'));
  });
});

it('shows AD-derived VAF in the detail panel and identifies its source', () => {
  render(<VariantDetailPanel taskId="test" variant={{ ...variant('AD sample'), annotationValues: { VAF: '.', AD: '60,46', Genotype: '0/1' } }} isOpen onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('tab', { name: '证据' }));
  expect(screen.getByText('43.4%')).toBeVisible();
  expect(screen.getByText(/原始 VAF 缺失，按 AD/)).toBeVisible();
});
