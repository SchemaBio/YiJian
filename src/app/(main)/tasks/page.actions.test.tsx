import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TaskActionsCell as TaskActions } from './components/TaskActionsCell';
import { normalizeTask } from '@/lib/tasks';
const mode = vi.hoisted(() => ({backend: 'octopus'}));
vi.mock('@/lib/runtime-config', () => ({getRuntimeBackendFlavor: () => mode.backend}));
beforeEach(() => {mode.backend = 'octopus';});
it('opens import failure details without offering a paid task retry or interpretation', () => {
 const onDetails=vi.fn(),onRetry=vi.fn(),onView=vi.fn();
 render(<TaskActions task={normalizeTask({id:'task',status:'completed',result_import_status:'failed'})} onDetails={onDetails} onView={onView} onStart={vi.fn()} onStop={vi.fn()} onRetry={onRetry} onEdit={vi.fn()} onDelete={vi.fn()} isLoading={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'结果导入失败'}));
 expect(onDetails).toHaveBeenCalled();expect(onRetry).not.toHaveBeenCalled();expect(onView).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:'解读'})).not.toBeInTheDocument();
});
it.each(['octopus','squid'])('allows queued trio analysis and keeps historical results readable in %s', backend => {
 mode.backend=backend;
 const onStart=vi.fn(),onRetry=vi.fn(),onView=vi.fn();
 const callbacks={onDetails:vi.fn(),onView,onStart,onStop:vi.fn(),onRetry,onEdit:vi.fn(),onDelete:vi.fn(),isLoading:false};
 const {rerender}=render(<TaskActions task={normalizeTask({id:'family',template:'trio',status:'queued'})} {...callbacks}/>);
 fireEvent.click(screen.getByRole('button',{name:'启动'}));expect(onStart).toHaveBeenCalled();
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

it.each(['failed', 'cancelled'])('keeps %s cloud node cleanup read-only until the service confirms release', status => {
 mode.backend='squid';
 const onStop=vi.fn(),onRetry=vi.fn();
 render(<TaskActions task={normalizeTask({id:'task',status,execution_phase:'release_failed'})} onDetails={vi.fn()} onView={vi.fn()} onStart={vi.fn()} onStop={onStop} onRetry={onRetry} onEdit={vi.fn()} onDelete={vi.fn()} isLoading={false}/>);
 const cleanup=screen.getByRole('button',{name:'系统自动回收节点'});
 expect(cleanup).toBeDisabled();fireEvent.click(cleanup);
 expect(screen.queryByRole('button',{name:'取消'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'重试'})).not.toBeInTheDocument();
 expect(onStop).not.toHaveBeenCalled();expect(onRetry).not.toHaveBeenCalled();
});

it.each(['running','archiving','terminating','release_failed','terminal'])('opens completed SaaS results during phase %s without a release button', phase => {
 mode.backend='squid';
 const onView=vi.fn(),onStop=vi.fn();
 const callbacks={onDetails:vi.fn(),onView,onStart:vi.fn(),onStop,onRetry:vi.fn(),onEdit:vi.fn(),onDelete:vi.fn(),isLoading:false};
 const {rerender}=render(<TaskActions task={normalizeTask({id:'task',template:'vcf2anno',status:'completed',execution_phase:phase})} {...callbacks}/>);
 fireEvent.click(screen.getByRole('button',{name:'解读'}));
 expect(onView).toHaveBeenCalledTimes(1);
 expect(screen.queryByRole('button',{name:/释放节点|取消|系统自动回收节点/})).not.toBeInTheDocument();
 expect(onStop).not.toHaveBeenCalled();
 rerender(<TaskActions task={normalizeTask({id:'task',template:'single',status:'pending_interpretation',execution_phase:phase})} {...callbacks}/>);
 expect(screen.getByRole('button',{name:'解读'})).toBeEnabled();
 expect(screen.queryByRole('button',{name:/释放节点|取消/})).not.toBeInTheDocument();
});

it('keeps cancellation for an active SaaS analysis',()=>{
 mode.backend='squid';const onStop=vi.fn();
 render(<TaskActions task={normalizeTask({id:'task',status:'running',execution_phase:'running'})} onDetails={vi.fn()} onView={vi.fn()} onStart={vi.fn()} onStop={onStop} onRetry={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} isLoading={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'取消'}));expect(onStop).toHaveBeenCalledWith('task');
});
