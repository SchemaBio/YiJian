import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  it('labels the quick result and its source without presenting it as ACMG points', async () => {
    render(<VariantDetailPanel taskId="task" variant={{...variant('A'),acmgClassification:'Benign',acmgAssessmentSource:'automatic',automaticAcmg:{profile:'fast',state:'evaluated',score:0,classification:'Benign',classificationBasis:'clinvar_reference',criteria:[],pending:[],screeningNotes:['ClinVar：Benign；专家组审核','gnomAD：总体 AF=0.2；常见']}}} isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', {name:'ACMG评定（现版）'}));
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

  it('browses both assessment tabs without adoption and requires a reason to adopt', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const assessed = {...variant('A'), activeAcmgVersion:'legacy' as const, svcv4Assessment:{revision:'fixed',source:'https://example.org',authoritative:false,disease:'疾病',moi:'AD',confirmed:true,inputs:{},result:{state:'classified',classification:'VUS',score:0,vusSubclass:'VUS-low',warnings:[],breakdown:{},details:{}}}} as SNVIndel;
    render(<VariantDetailPanel taskId="task" variant={assessed} isOpen onClose={vi.fn()} onSaveVersionedAssessment={save} />);
    fireEvent.click(screen.getByRole('tab',{name:'ACMG评定（SVC v4.0试行）'}));
    fireEvent.click(screen.getByRole('tab',{name:'ACMG评定（现版）'}));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab',{name:'ACMG评定（SVC v4.0试行）'}));
    fireEvent.click(screen.getByRole('button',{name:'采用SVC v4.0试行结果'}));
    expect(screen.getByText('请填写版本切换理由')).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('版本切换理由'),{target:{value:'完成复核，采用试行结果'}});
    fireEvent.click(screen.getByRole('button',{name:'采用SVC v4.0试行结果'}));
    await waitFor(()=>expect(save).toHaveBeenCalledWith(assessed,{activeAcmgVersion:'svcv4'},'完成复核，采用试行结果'));
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
