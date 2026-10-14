import * as React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VariantDetailPanel } from './VariantDetailPanel';
import type { SNVIndel } from '../types';
vi.mock('@/lib/svcv4',()=>({getSVCv4Schema:vi.fn().mockResolvedValue({revision:'fixed',source:'https://example.org',moi:['AD'],geneDiseaseValidity:['MODERATE'],workflows:[],population:{type:'object',properties:{}},case:{type:'object',properties:{}},caseControl:{type:'object',properties:{}},unsupported:[]})}));

vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('../result-api', async importOriginal => ({
  ...await importOriginal<typeof import('../result-api')>(),
  getResultRowAdjustmentHistory: vi.fn().mockResolvedValue([]),
}));

const variant = (id: string) => ({ id, gene: id, chromosome: '1', position: 100,
  ref: 'A', alt: 'G', variantType: 'SNV', zygosity: 'Heterozygous', pinned: false, reviewed: false, alleleFrequency: 0.5, depth: 100,
  transcript: 'NM_001000', hgvsc: 'c.1A>G', hgvsp: 'p.(Lys1Arg)', consequence: 'missense_variant',
  reported: false, interpretation: '', acmgCriteria: [], annotationValues: {},
}) as SNVIndel;

describe('same-screen interpretation', () => {
  it('links each dbSNP identifier in the annotation tab and rejects non-rs values', () => {
    render(<VariantDetailPanel taskId="task" variant={{...variant('A'), rsId:'rs671;RS123', annotationValues:{dbSNP:'rs671&rs456&invalid'}}} isOpen onClose={vi.fn()} />);
    const identifiers = screen.getByRole('heading', {name:'变异标识'}).parentElement!;
    for (const id of ['rs671', 'rs123', 'rs456']) {
      const link = within(identifiers).getByRole('link', {name:id});
      expect(link).toHaveAttribute('href', `https://www.ncbi.nlm.nih.gov/snp/${id}`);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(within(identifiers).queryByRole('link', {name:'invalid'})).not.toBeInTheDocument();
  });
  it('shows transcript location, totals and HGVS in annotation', async () => {
    render(<VariantDetailPanel taskId="task" variant={{ ...variant('A'), annotationValues: { Location: 'Exon 2/20' } }} isOpen onClose={vi.fn()} />);
    const section = screen.getByRole('heading', { name: '转录本与 HGVS' }).closest('section')!;
    await waitFor(() => expect(within(section).getByText('NM_001000')).toBeVisible());
    expect(within(section).getByText('20')).toBeVisible();
    expect(within(section).getByText('19（按外显子总数推算）')).toBeVisible();
    expect(within(section).getByText('c.1A>G')).toBeVisible();
    expect(within(section).getByText('p.(Lys1Arg)')).toBeVisible();
  });
  it('labels the quick result and its source without presenting it as ACMG points', async () => {
    render(<VariantDetailPanel taskId="task" variant={{...variant('A'),acmgClassification:'Benign',acmgAssessmentSource:'automatic',automaticAcmg:{profile:'fast',state:'evaluated',score:0,classification:'Benign',classificationBasis:'clinvar_reference',criteria:[],pending:[],screeningNotes:['ClinVar：Benign；专家组审核','gnomAD：总体 AF=0.2；常见']}}} isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', {name:'ACMG'}));
    expect(await screen.findByText('快速初评 · ClinVar 参考')).toBeVisible();
    expect(screen.getByText('ClinVar：Benign；专家组审核')).toBeVisible();
    expect(screen.getByText('gnomAD：总体 AF=0.2；常见')).toBeVisible();
    expect(screen.queryByText('证据不足，当前无法形成 ACMG 分类')).not.toBeInTheDocument();
  });
  it('clears interpretation without a reason', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<VariantDetailPanel taskId="task" variant={{...variant('A'), interpretation:'旧解读'}} isOpen onClose={vi.fn()} onSaveInterpretation={save} />);
    fireEvent.click(screen.getByRole('tab', {name:'人工解读'}));
    fireEvent.change(screen.getByPlaceholderText('请输入您对该变异的解读分析...'), {target:{value:''}});
    fireEvent.click(screen.getByRole('button', {name:'保存人工解读'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({id:'A'}),'',''));
  });

  it('browses both assessment tabs without adoption and adopts without entering a reason', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const assessed = {...variant('A'), activeAcmgVersion:'legacy' as const, svcv4Assessment:{revision:'fixed',source:'https://example.org',authoritative:false,disease:'疾病',moi:'AD',confirmed:true,inputs:{},result:{state:'classified',classification:'VUS',score:0,vusSubclass:'VUS-low',warnings:[],breakdown:{},details:{}}}} as SNVIndel;
    render(<VariantDetailPanel taskId="task" variant={assessed} isOpen onClose={vi.fn()} onSaveVersionedAssessment={save} />);
    expect(within(screen.getByRole('tablist', {name:'详情内容'})).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['注释', '证据', 'ACMG', '人工解读', '变更记录']);
    expect(screen.queryByRole('tablist', {name:'ACMG 计算器版本'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:'ACMG'}));
    const currentTab = screen.getByRole('tab',{name:'现版'});
    expect(currentTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(currentTab, {key:'ArrowRight'});
    expect(screen.getByRole('tab',{name:'SVC v4.0版'})).toHaveFocus();
    expect(screen.getByRole('tab',{name:'SVC v4.0版'})).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab',{name:'现版'}));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab',{name:'SVC v4.0版'}));
    fireEvent.click(screen.getByRole('button',{name:'采用SVC v4.0试行结果'}));
    expect(screen.queryByLabelText('版本切换理由')).not.toBeInTheDocument();
    await waitFor(()=>expect(save).toHaveBeenCalledWith(assessed,{activeAcmgVersion:'svcv4'},''));
  });

  it('shows both AI entries even when the AI service is unavailable', async () => {
    render(<VariantDetailPanel taskId="task" variant={variant('A')} isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'ACMG' }));
    expect(screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' })).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: 'SVC v4.0版' }));
    await screen.findByRole('button', { name: '计算新版评定' });
    expect(screen.getByRole('button', { name: 'AI 生成SVC v4.0 草案实验' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'AI 生成SVC v4.0 草案实验' })).toBeDisabled();
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

  it('opens on annotation, puts GenCC before resource links and keeps only the header close control', async () => {
    const annotated = { ...variant('BRCA1'), annotationValues: { GenCC_disease_title: '示例疾病关联', GenCC_moi_title: '常染色体显性', GenCC_disease_original_curie: 'OMIM:123456' } };
    render(<VariantDetailPanel taskId="task" variant={annotated} isOpen onClose={vi.fn()} />);
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
    expect(save).toHaveBeenCalledWith(expect.objectContaining({id:'A'}),'A 解读','');
    rerender(<VariantDetailPanel {...props} variant={variant('B')} />);
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    const editor = screen.getByPlaceholderText('请输入您对该变异的解读分析...');
    fireEvent.change(editor, { target: { value: 'B 解读' } });
    finish();
    await waitFor(() => expect(editor).toHaveValue('B 解读'));
  });
});
