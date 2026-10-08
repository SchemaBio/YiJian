import {render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AssessmentStatusBar} from './AssessmentStatusBar';
import {assessmentStatus} from '@/lib/assessment/client';
vi.mock('@/lib/assessment/client',()=>({assessmentStatus:vi.fn(),cancelAssessment:vi.fn()}));
vi.mock('@/lib/parquet-browser',()=>({retryBrowserAssessment:vi.fn(),reevaluateBrowserResults:vi.fn()}));
afterEach(()=>vi.clearAllMocks());
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
