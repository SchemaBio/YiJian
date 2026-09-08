import { describe, expect, it } from 'vitest';
import { normalizeTask, normalizeTaskDetail } from './tasks';

describe('execution state responses', () => {
  it('preserves the durable attempt and queued phase', () => {
    const response = { id: 'task', status: 'queued', execution_phase: 'waiting_quota', attempt_id: 'attempt', phase_updated_at: '2026-09-05T00:00:00Z' };
    for (const task of [normalizeTask(response), normalizeTaskDetail(response)]) {
      expect(task.executionPhase).toBe('waiting_quota');
      expect(task.attemptId).toBe('attempt');
      expect(task.phaseUpdatedAt).toBe(response.phase_updated_at);
    }
  });

  it('keeps the reason when admission ends a queued request', () => {
    expect(normalizeTask({ id: 'task', status: 'failed', execution_phase: 'terminal', execution_reason_code: 'ADMISSION_REJECTED' })).toMatchObject({ status: 'failed', executionPhase: 'terminal', executionReasonCode: 'ADMISSION_REJECTED' });
  });
});
