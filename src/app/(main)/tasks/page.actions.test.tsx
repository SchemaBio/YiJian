import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TaskActionsCell as TaskActions } from './components/TaskActionsCell';
import { normalizeTask } from '@/lib/tasks';
const mode = vi.hoisted(() => ({backend: 'octopus'}));
vi.mock('@/lib/runtime-config', () => ({getRuntimeBackendFlavor: () => mode.backend}));
beforeEach(() => {mode.backend = 'octopus';});
it.each(['octopus','squid'])('disables queued family analysis but keeps historical results readable in %s', backend => {
 mode.backend=backend;
 const onStart=vi.fn(),onRetry=vi.fn(),onView=vi.fn();
 const callbacks={onDetails:vi.fn(),onView,onStart,onStop:vi.fn(),onRetry,onEdit:vi.fn(),onDelete:vi.fn(),isLoading:false};
 const {rerender}=render(<TaskActions task={normalizeTask({id:'family',template:'trio',status:'queued'})} {...callbacks}/>);
 const unavailable=screen.getByRole('button',{name:'家系分析暂未开放'});
 expect(unavailable).toBeDisabled();fireEvent.click(unavailable);
 expect(onStart).not.toHaveBeenCalled();expect(onRetry).not.toHaveBeenCalled();
 rerender(<TaskActions task={normalizeTask({id:'family',template:'trio',status:'completed'})} {...callbacks}/>);
 fireEvent.click(screen.getByRole('button',{name:'解读'}));expect(onView).toHaveBeenCalled();
});
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

it.each(['running', 'terminating', 'release_failed'])('shows retry for a failed self-hosted task with stale phase %s', phase => {
 const onRetry=vi.fn(),onStop=vi.fn();
 render(<TaskActions task={normalizeTask({id:'task',status:'failed',execution_phase:phase})} onDetails={vi.fn()} onView={vi.fn()} onStart={vi.fn()} onStop={onStop} onRetry={onRetry} onEdit={vi.fn()} onDelete={vi.fn()} isLoading={false}/>);
 expect(screen.queryByRole('button',{name:'取消'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'重试'}));
 expect(onRetry).toHaveBeenCalledWith('task');
 expect(onStop).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'编辑'})).toBeEnabled();
});

it('preserves SaaS cancellation while a failed cloud task still owns its node', () => {
 mode.backend='squid';
 const onStop=vi.fn(),onRetry=vi.fn();
 render(<TaskActions task={normalizeTask({id:'task',status:'failed',execution_phase:'running'})} onDetails={vi.fn()} onView={vi.fn()} onStart={vi.fn()} onStop={onStop} onRetry={onRetry} onEdit={vi.fn()} onDelete={vi.fn()} isLoading={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'取消'}));
 expect(onStop).toHaveBeenCalledWith('task');
 expect(screen.queryByRole('button',{name:'重试'})).not.toBeInTheDocument();
 expect(onRetry).not.toHaveBeenCalled();
});
