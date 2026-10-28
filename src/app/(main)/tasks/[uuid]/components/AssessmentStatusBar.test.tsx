import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AssessmentStatusBar} from './AssessmentStatusBar';
import {assessmentStatus} from '@/lib/assessment/client';
import {reevaluateBrowserResults} from '@/lib/parquet-browser';
import {InterpretationReadOnlyContext} from './InterpretationLock';
vi.mock('@/lib/assessment/client',()=>({assessmentStatus:vi.fn(),cancelAssessment:vi.fn()}));
vi.mock('@/lib/parquet-browser',()=>({retryBrowserAssessment:vi.fn(),reevaluateBrowserResults:vi.fn()}));
afterEach(()=>vi.clearAllMocks());
it('shows provisional rows with an incomplete notice and withdraws them on cancellation',()=>{
 vi.mocked(assessmentStatus).mockReturnValue({taskId:'task',state:'loading',processed:25,preview:[{rowId:'synthetic',table:'snv-indel',gene:'PREVIEW_GENE',classification:'VUS',score:4,criteria:[],pending:[]}]});
 render(<AssessmentStatusBar taskId="task" table="snv-indel"/>);
 fireEvent.click(screen.getByRole('button',{name:'行级初评预览'}));
 expect(screen.getByText('PREVIEW_GENE')).toBeInTheDocument();expect(screen.getByText(/全局排序和置顶仍在处理中/)).toBeInTheDocument();
 fireEvent(window,new CustomEvent('yijian:assessment-status',{detail:{taskId:'task',state:'cancelled',processed:25}}));
 expect(screen.queryByText('PREVIEW_GENE')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'行级初评预览'})).not.toBeInTheDocument();
});
it('keeps reassessment available after completion even when evidence has not changed',async()=>{
 vi.mocked(assessmentStatus).mockReturnValue({taskId:'task',state:'ready',processed:100,reassessmentAvailable:false});
 render(<AssessmentStatusBar taskId="task"/>);
 fireEvent.click(screen.getByRole('button',{name:'重新初评'}));
 await waitFor(()=>expect(reevaluateBrowserResults).toHaveBeenCalledWith('task'));
});
it('retains the updated-evidence label when a newer context is available',()=>{
 vi.mocked(assessmentStatus).mockReturnValue({taskId:'task',state:'ready',processed:100,reassessmentAvailable:true});
 render(<AssessmentStatusBar taskId="task"/>);
 expect(screen.getByRole('button',{name:'证据版本已更新，重新评估'})).toBeInTheDocument();
});
it('hides reassessment for a read-only interpretation',()=>{
 vi.mocked(assessmentStatus).mockReturnValue({taskId:'task',state:'ready',processed:100,reassessmentAvailable:false});
 render(<InterpretationReadOnlyContext.Provider value={true}><AssessmentStatusBar taskId="task"/></InterpretationReadOnlyContext.Provider>);
 expect(screen.queryByRole('button',{name:'重新初评'})).not.toBeInTheDocument();
});
it('opens a scored candidate gene list with the associated disease',()=>{
 vi.mocked(assessmentStatus).mockReturnValue({taskId:'task',state:'ready',processed:1,geneRanking:[{gene:'FIXTURE',diseaseId:'OMIM:1',diseaseName:'Fixture disease',score:.8,eligible:true,matched:[{id:'HP:0000001'}],source:'public fixture'}]});
 render(<AssessmentStatusBar taskId="task"/>);fireEvent.click(screen.getByRole('button',{name:'HPO 候选基因'}));
 expect(screen.getByText('FIXTURE')).toBeInTheDocument();expect(screen.getByText('80.0%')).toBeInTheDocument();expect(screen.getByText('Fixture disease')).toBeInTheDocument();
});
it('shows a themed retry control without failure or cancellation prose after user cancellation',()=>{
 vi.mocked(assessmentStatus).mockReturnValue({taskId:'task',state:'cancelled',processed:100});
 render(<AssessmentStatusBar taskId="task" />);
 expect(screen.getByRole('button',{name:'重试本地初评'}).className).toContain('yj-tool-button');
 expect(screen.queryByRole('status')).not.toBeInTheDocument();
 expect(screen.queryByText(/初评已取消|初评失败|signal is aborted/)).not.toBeInTheDocument();
});
it('retains actionable error details for an actual assessment failure',()=>{
 vi.mocked(assessmentStatus).mockReturnValue({taskId:'task',state:'error',processed:0,error:'评估数据内容校验失败'});
 render(<AssessmentStatusBar taskId="task" />);
 expect(screen.getByText('评估数据内容校验失败')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'重试本地初评'}).className).toContain('yj-tool-button');
});
