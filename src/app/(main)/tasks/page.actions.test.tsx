import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { TaskActionsCell as TaskActions } from './components/TaskActionsCell';
import { normalizeTask } from '@/lib/tasks';
it('disables detail and interpretation for completed calibration jobs',()=>{
 const onDetails=vi.fn(),onView=vi.fn();
 render(<TaskActions task={normalizeTask({id:'task',template:'baseline_fix',status:'completed'})} onDetails={onDetails} onView={onView} onStart={vi.fn()} onStop={vi.fn()} onRetry={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} isLoading={false}/>);
 const details=screen.getByRole('button',{name:'查看任务 task 详情'});
 expect(details).toBeDisabled();expect(screen.getByRole('button',{name:'完成'})).toBeDisabled();
 expect(screen.queryByRole('button',{name:'解读'})).not.toBeInTheDocument();
 fireEvent.click(details);expect(onDetails).not.toHaveBeenCalled();expect(onView).not.toHaveBeenCalled();
});
it('keeps regular WES task details and interpretation enabled',()=>{
 render(<TaskActions task={normalizeTask({id:'task',template:'single',status:'completed'})} onDetails={vi.fn()} onView={vi.fn()} onStart={vi.fn()} onStop={vi.fn()} onRetry={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} isLoading={false}/>);
 expect(screen.getByRole('button',{name:'查看任务 task 详情'})).toBeEnabled();
 expect(screen.getByRole('button',{name:'解读'})).toBeEnabled();
});

it('keeps calibration cancellation available while execution is in flight',()=>{
 const onStop=vi.fn();
 render(<TaskActions task={normalizeTask({id:'task',template:'baseline_fix',status:'running',execution_phase:'running'})} onDetails={vi.fn()} onView={vi.fn()} onStart={vi.fn()} onStop={onStop} onRetry={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} isLoading={false}/>);
 expect(screen.getByRole('button',{name:'查看任务 task 详情'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'取消'}));expect(onStop).toHaveBeenCalledWith('task');
});
