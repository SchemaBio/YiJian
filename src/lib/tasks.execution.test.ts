import { describe, expect, it } from 'vitest';
import { normalizeTask, normalizeTaskDetail, normalizeTaskProgress } from './tasks';

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

  it('preserves optional bootstrap heartbeat and diagnostic hold fields', () => {
    const response = {
      id: 'task',
      uuid: 'task',
      status: 'queued',
      execution_phase: 'diagnostic_hold',
      bootstrap_phase: 'references',
      bootstrap_last_heartbeat_at: '2026-09-19T08:00:00Z',
      diagnostic_hold_until: '2026-09-19T08:20:00Z',
      diagnostic_summary: 'reference database download failed',
    };

    for (const task of [normalizeTask(response), normalizeTaskDetail(response)]) {
      expect(task).toMatchObject({
        executionPhase: 'diagnostic_hold',
        bootstrapPhase: 'references',
        bootstrapLastHeartbeatAt: response.bootstrap_last_heartbeat_at,
        diagnosticHoldUntil: response.diagnostic_hold_until,
        diagnosticSummary: response.diagnostic_summary,
      });
    }

    expect(normalizeTaskProgress(response)).toMatchObject({
      execution_phase: 'diagnostic_hold',
      bootstrap_phase: 'references',
      bootstrap_last_heartbeat_at: response.bootstrap_last_heartbeat_at,
      diagnostic_hold_until: response.diagnostic_hold_until,
      diagnostic_summary: response.diagnostic_summary,
    });
  });
});
