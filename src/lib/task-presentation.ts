import type { AnalysisTask, TaskStatus } from '@/types/task';
export type TaskDisplayStatus = TaskStatus | 'interpretation_completed';
export const taskStatusConfig: Record<TaskDisplayStatus, { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = {
  waiting_for_data: { label: '等待数据', variant: 'warning' },
  queued: { label: '排队中', variant: 'neutral' },
  running: { label: '运行中', variant: 'neutral' },
  completed: { label: '分析完成', variant: 'info' },
  interpretation_completed: { label: '解读完成', variant: 'success' },
  failed: { label: '失败', variant: 'danger' },
  cancelled: { label: '已取消', variant: 'neutral' },
  pending_interpretation: { label: '待解读', variant: 'warning' },
};
export function taskDisplayStatus(task: { status: TaskStatus; interpretationCompletedAt?: string }): TaskDisplayStatus {
  return task.interpretationCompletedAt ? 'interpretation_completed' : task.status;
}
export function sortTasksByInterpretation(tasks: AnalysisTask[]): AnalysisTask[] {
  return [...tasks].sort((a, b) => Number(!!a.interpretationCompletedAt) - Number(!!b.interpretationCompletedAt));
}
export function taskStatusClass(status: TaskDisplayStatus): string { return `yj-task-status-${status}`; }

export function taskDisplayCreatedAt(task: { createdAt: string; retryStartedAt?: string }): string {
  return task.retryStartedAt || task.createdAt;
}
