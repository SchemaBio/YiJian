import * as React from 'react';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { it,expect,vi } from 'vitest';
import { CNVAssessmentPanel } from './CNVAssessmentPanel';
import { useCNVAssessment } from '../hooks/useCNVAssessment';
import type { CNVSegment } from '../types';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
vi.mock('@/components/shared/WorkspaceInspector',()=>({WorkspaceInspector:({children}:any)=><div>{children}</div>}));
vi.mock('@/components/shared/AIAssistanceAction',()=>({
 AIAssistanceAction:({onResult,input}:any)=><button onClick={()=>onResult({requestId:'generated',variantId:input.variant.id,feature:input.feature,summary:'Synthetic',agentProposal:{ai_assessment:{criteria:[]},sources:[]}})}>Generate synthetic</button>,
 AIResultCard:()=>null,
}));
vi.mock('./assessment/Section1Panel',()=>({Section1Panel:()=>null}));
vi.mock('./assessment/Section2Panel',()=>({Section2Panel:()=>null}));
vi.mock('./assessment/Section4Panel',()=>({Section4Panel:()=>null}));
vi.mock('./assessment/Section5Panel',()=>({Section5Panel:()=>null}));
const save=vi.fn();
function Harness({type='Deletion',initial}:{type?:'Deletion'|'Amplification';initial?:AIAssistanceResult}){
 const cnv: CNVSegment={id:'A',type,chromosome:'1',startPosition:1,endPosition:100,genes:[],length:99,copyNumber:1,copyRatio:.5,log2Ratio:-1,confidence:null,pinned:false,reviewed:false,focused:false,interpretation:''};
 const {assessment,updateCriteria}=useCNVAssessment(cnv);
 return <CNVAssessmentPanel taskId="task" cnv={cnv} assessment={assessment} isOpen onClose={()=>{}} onCriteriaChange={updateCriteria} onSave={save} initialAIResult={initial}/>;
}
it.each(['Deletion','Amplification'] as const)('automatically fills missing fields and displays recalculated result for %s without saving',async type=>{
 render(<Harness type={type}/>);
 fireEvent.click(screen.getByRole('button',{name:'Generate synthetic'}));
 await waitFor(()=>expect(screen.getByLabelText('蛋白编码基因数量')).toHaveValue(0));
 expect(screen.getAllByText(/AI 已自动填入/).length).toBeGreaterThan(0);
 expect(screen.getByText(/Section 1, Section 2, Section 3/)).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'填入评估表'})).not.toBeInTheDocument();
 expect(screen.getByText(/意义未明/)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('蛋白编码基因数量'),{target:{value:'50'}});
 expect(screen.getByLabelText('蛋白编码基因数量')).toHaveValue(50);
 expect(save).not.toHaveBeenCalled();
});
it('fills a result arriving from the detail entry immediately',async()=>{
 const initial={requestId:'from-detail',variantId:'A',feature:'cnv_loss',agentProposal:{ai_assessment:{criteria:[]},sources:[]}} as AIAssistanceResult;
 render(<Harness initial={initial}/>);
 await waitFor(()=>expect(screen.getByLabelText('蛋白编码基因数量')).toHaveValue(0));
 expect(save).not.toHaveBeenCalled();
});
