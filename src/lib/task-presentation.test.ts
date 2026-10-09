import { describe, expect, it, vi } from 'vitest';
import { normalizeTask, normalizeTaskDetail, tasksApi } from './tasks';
import { sortTasksByInterpretation, taskDisplayCreatedAt, taskDisplayStatus, taskStatusConfig } from './task-presentation';
import { api } from './api';

describe('interpretation completion', () => {
  it('displays the accepted retry time in list and detail and falls back for original tasks', () => {
    const raw = { id: 'task', created_at: '2026-09-01T00:00:00Z', retryStartedAt: '2026-10-09T08:00:00Z' };
    for (const task of [normalizeTask(raw), normalizeTaskDetail(raw)]) {
      expect(taskDisplayCreatedAt(task)).toBe(raw.retryStartedAt);
      expect(task.createdAt).toBe(raw.created_at);
    }
    expect(taskDisplayCreatedAt(normalizeTask({ created_at: raw.created_at }))).toBe(raw.created_at);
  });
  it('keeps execution status and completion identity in list and detail responses', () => {
    const raw = { id: 'task', status: 'completed', interpretationCompletedAt: '2026-10-09T08:00:00Z', interpretationCompletedBy: 'doctor@example.com' };
    for (const task of [normalizeTask(raw), normalizeTaskDetail(raw)]) {
      expect(task).toMatchObject(raw);
      expect(taskDisplayStatus(task)).toBe('interpretation_completed');
    }
    expect(taskDisplayStatus(normalizeTask({ status: 'completed' }))).toBe('completed');
  });

  it('moves finished interpretations to the bottom while preserving order and input', () => {
    const tasks = [normalizeTask({ id: 'closed-a', status: 'completed', interpretationCompletedAt: 'now' }), normalizeTask({ id: 'active-a', status: 'completed' }), normalizeTask({ id: 'closed-b', status: 'completed', interpretationCompletedAt: 'now' }), normalizeTask({ id: 'active-b', status: 'running' })];
    expect(sortTasksByInterpretation(tasks).map(t => t.id)).toEqual(['active-a', 'active-b', 'closed-a', 'closed-b']);
    expect(tasks.map(t => t.id)).toEqual(['closed-a', 'active-a', 'closed-b', 'active-b']);
    expect(new Set(['running', 'completed', 'interpretation_completed'].map(status => taskStatusConfig[status as keyof typeof taskStatusConfig].variant)).size).toBe(3);
  });

  it('sends an explicit false and current attempt when reopening', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({ id: 'task', status: 'completed' });
    try {
      const task = await tasksApi.setInterpretationCompleted('task', false, 'attempt');
      expect(put).toHaveBeenCalledWith('/v1/tasks/task/interpretation-completion', { completed: false, attemptId: 'attempt' });
      expect(task.interpretationCompletedAt).toBeUndefined();
    } finally { put.mockRestore(); }
  });
});
