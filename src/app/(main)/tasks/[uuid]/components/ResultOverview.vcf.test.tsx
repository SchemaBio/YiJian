import * as React from 'react';
import {render,screen,within} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {ResultOverview} from './ResultOverview';
import type {ResultContext} from '../types';
const sample={id:'sample',internalId:'SAMPLE-001',gender:'male' as const};
function context(overrides:Partial<ResultContext>={}):ResultContext {
 return {state:'ready',importStatus:'success',taskUuid:'task',executionAttemptId:'attempt',version:'1',members:[{id:'sample',sampleId:'sample',role:'single'}],qc:[],reference:{available:true,declaredId:'GRCh37'},types:{'snv-indel':{total:54946,focused:2,reviewed:0},'cnv-segment':{total:10,focused:0,reviewed:0}},permissions:{canReview:true,canFocus:true},capabilities:['snv_indel','report','vcf'],vcfAnnotation:{preprocessing:{input_records:67605,normalized_variants:54946,excluded_reference_gt:11501,excluded_missing_or_partial_gt:1158,excluded_unsupported_type:0},sex_inference:{x_sum:834,x_hom:730,x_haploid_alt:0,ratio:730/834,sex:'male'}},...overrides};
}
it('uses WES-style panels with SNP/InDel only and verifies sex from chrX',()=>{
 const navigate=vi.fn();render(<ResultOverview context={context()} sample={sample} onNavigate={navigate}/>);
 expect(screen.queryByRole('heading',{name:'质控统计'})).not.toBeInTheDocument();
 const counts=screen.getByRole('region',{name:'结果类型概览'});
 expect(within(counts).getByRole('button',{name:/SNP.*InDel/})).toBeInTheDocument();
 expect(within(counts).queryByText(/CNV|STR|线粒体/)).not.toBeInTheDocument();
 const verification=screen.getByRole('region',{name:'样本与性别核对'});
 expect(within(verification).getByText('SAMPLE-001')).toBeInTheDocument();
 expect(within(verification).getAllByText('男')).toHaveLength(2);
 expect(within(verification).getByText('87.53%')).toBeInTheDocument();
 expect(within(verification).getByText('一致')).toBeInTheDocument();
 expect(within(verification).queryByText(/SRY/)).not.toBeInTheDocument();
 expect(within(verification).getByText(/X 染色体结构变异.*降低推算准确率/)).toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'VCF 预处理统计'})).toBeInTheDocument();
});
it('flags a difference from registered sex without changing the sample',()=>{
 const registered={...sample,gender:'female' as const};
 render(<ResultOverview context={context()} sample={registered} onNavigate={vi.fn()}/>);
 const verification=screen.getByRole('region',{name:'样本与性别核对'});
 expect(within(verification).getByText('需核对')).toHaveClass('text-warning-fg');
 expect(registered.gender).toBe('female');
});
it.each([
 {x_sum:0,ratio:null,sex:'unknown',reason:'no_x_variants'},
 {x_sum:5,ratio:1,sex:'unknown',reason:'insufficient_x_variants'},
 {x_sum:100,ratio:0.6,sex:'unknown',reason:'ratio_in_uncertain_interval'},
])('keeps uncertain chrX inference unknown for $reason',inference=>{
 render(<ResultOverview context={context({vcfAnnotation:{sex_inference:inference}})} sample={sample} onNavigate={vi.fn()}/>);
 const verification=screen.getByRole('region',{name:'样本与性别核对'});
 expect(within(verification).getByText('未知')).toBeInTheDocument();
 expect(within(verification).getByText('信息不足')).toBeInTheDocument();
 expect(within(verification).queryByText('女')).not.toBeInTheDocument();
});
it('keeps WES QC and its SRY-based verification unchanged',()=>{
 render(<ResultOverview context={context({capabilities:['snv_indel','qc'],vcfAnnotation:undefined,qc:[{memberId:'sample',memberRole:'single',sampleId:'sample',declaredGender:'male',predictedGender:'male',genderComparison:'match',sryCutoff:5,metrics:[{key:'sryCount',value:10}]}]})} sample={sample} onNavigate={vi.fn()}/>);
 expect(screen.getByRole('heading',{name:'质控统计'})).toBeInTheDocument();
 expect(screen.getByText('SRY reads')).toBeInTheDocument();
 expect(screen.getByText(/数据性别来自本次 SRY 检测/)).toBeInTheDocument();
 expect(screen.queryByRole('heading',{name:'VCF 预处理统计'})).not.toBeInTheDocument();
});
