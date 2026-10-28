import {render,screen,fireEvent} from '@testing-library/react';
import {expect,it} from 'vitest';
import {EvidenceQualityPanel} from './EvidenceQualityPanel';

it('keeps historical and unknown-version records explicitly unverified',()=>{
 const {rerender}=render(<EvidenceQualityPanel proposal={{}}/>);
 expect(screen.getByText(/此记录未保存逐条证据绑定/)).toBeInTheDocument();
 rerender(<EvidenceQualityPanel proposal={{evidence_quality:{version:'future',criteria:[{code:'PP3',status:'supported'}]}}}/>);
 expect(screen.getByText(/此记录未保存逐条证据绑定/)).toBeInTheDocument();expect(screen.queryByText('PP3: 已有证据支持')).not.toBeInTheDocument();
});

it('distinguishes a traceable excerpt from independently established clinical support',()=>{
 render(<EvidenceQualityPanel proposal={{evidence_quality:{version:'evidence-quality-v1',criteria:[{code:'PP3',status:'pending_review'}],evidence_bindings:[{code:'PP3',issues:[],bindings:[{fact:'computational',status:'pending_review',origin:'model',reason:'excerpt_requires_review',source_id:'source-one',source_title:'Synthetic record',source_url:'https://pubmed.ncbi.nlm.nih.gov/123/',source_version:'fixture-v1',excerpt:'<script>Synthetic text is rendered as text.</script>'}]}]}}}/>);
 fireEvent.click(screen.getByText('查看事实与引用绑定'));
 expect(screen.getByText('摘录可以定位，但是否支持该临床条款仍需复核。')).toBeInTheDocument();
 expect(screen.getByText('Synthetic record').getAttribute('href')).toBe('https://pubmed.ncbi.nlm.nih.gov/123/');
 expect(screen.getByText('<script>Synthetic text is rendered as text.</script>')).toBeInTheDocument();expect(document.querySelector('script')).toBeNull();
 expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it.each(['javascript:alert(1)','file:///private','https://user:secret@example.org/source'])('does not link unsafe or credential-bearing source URLs: %s',url=>{
 render(<EvidenceQualityPanel proposal={{evidence_quality:{version:'evidence-quality-v1',criteria:[],evidence_bindings:[{code:'2A',issues:['excerpt_not_located'],bindings:[{status:'invalid',source_id:'source',source_title:'Unsafe reference',source_url:url,reason:'excerpt_not_located'}]}]}}}/>);
 expect(screen.getByText('Unsafe reference').tagName).not.toBe('A');expect(screen.getByText(/部分条款使用默认值或已降级/)).toBeInTheDocument();
});

it('handles incomplete old metadata and caller defaults without inventing source versions',()=>{
 render(<EvidenceQualityPanel defaultedFields={['section3']} proposal={{evidence_quality:{version:'evidence-quality-v1',criteria:'malformed',evidence_bindings:[{code:'2A',bindings:[{source_id:'source',status:'supported',origin:'rule_engine',reason:'independent_structured_fact',fact_id:'criterion.2A.complete_hi_overlap'}]}]}}}/>);
 expect(screen.getByText('来源：独立规则事实')).toBeInTheDocument();expect(screen.getByText('来源版本: 未记录')).toBeInTheDocument();expect(screen.getByText(/部分条款使用默认值或已降级/)).toBeInTheDocument();
});

it('keeps query absence, service failure and unqueried questions separate',()=>{
 render(<EvidenceQualityPanel proposal={{evidence_quality:{version:'evidence-quality-v1',criteria:[],evidence_bindings:[],remaining_questions:1,retrieval_findings:[{purpose:'variant_conflict',status:'not_found'},{purpose:'functional_evidence',status:'unavailable'},{purpose:'case_segregation',status:'supported',codes:['4A']}]}}}/>);
 fireEvent.click(screen.getByText('检索问题与材料状态'));
 expect(screen.getByText('变异记录与冲突线索: 本次查询未返回记录')).toBeInTheDocument();expect(screen.getByText('功能与机制证据: 检索未完成或不可用')).toBeInTheDocument();expect(screen.getByText('仍有 1 个问题尚未查询，相关信息保持未知。')).toBeInTheDocument();expect(screen.getByText(/同一文献的多份记录不代表独立病例/)).toBeInTheDocument();
});

it('does not present traceable structured inputs or omitted fields as verified criteria',()=>{
 render(<EvidenceQualityPanel proposal={{evidence_quality:{version:'evidence-quality-v1',structured_inputs_omitted:12,criteria:[],evidence_bindings:[{code:'PVS1',bindings:[{status:'context_only',reason:'structured_input_requires_rule_applicability',fact_id:'input.mechanism.lof_established',source_id:'source'}]}]}}}/>);
 expect(screen.getByText(/省略了 12 个字段/)).toBeInTheDocument();expect(screen.getByText(/条款适用性仍须由规则或专业复核确认/)).toBeInTheDocument();expect(screen.queryByText('PVS1: 已有证据支持')).not.toBeInTheDocument();
});
