import { canInterpretTask } from './task-interpretation';
import { getRuntimeApiBaseUrl, getRuntimeBackendFlavor } from './runtime-config';

export type TaskDetailAccess = 'allowed' | 'not_found' | 'unauthorized' | 'unavailable';

// Never derive the credential destination from an incoming Host header.
function taskApiBase(): string {
  const configured = process.env.YIJIAN_SERVER_API_URL || getRuntimeApiBaseUrl();
  if (/^https?:\/\//.test(configured)) return configured.replace(/\/+$/, '');
  const flavor = getRuntimeBackendFlavor();
  const host = process.env.NODE_ENV === 'production' ? flavor : '127.0.0.1';
  return `http://${host}:8080${configured || '/api'}`;
}

export async function checkTaskDetailAccess(id: string, token: string): Promise<TaskDetailAccess> {
  const prefix = getRuntimeBackendFlavor() === 'squid' ? '/v1/octopus' : '/v1';
  try {
    const response = await fetch(`${taskApiBase()}${prefix}/tasks/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401) return 'unauthorized';
    if (response.status === 403 || response.status === 404) return 'not_found';
    if (!response.ok) return 'unavailable';
    const body = await response.json();
    const task = body.data ?? body;
    if (!task || task.id !== id || typeof task.template !== 'string') return 'unavailable';
    return canInterpretTask(task) ? 'allowed' : 'not_found';
  } catch {
    return 'unavailable';
  }
}
