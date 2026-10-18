import {apiResourceURL} from './api';

export function igvAPIURL(taskId: string, value: string): string {
  if (!value.startsWith(`/v1/tasks/${encodeURIComponent(taskId)}/results/igv/`) || value.includes('#'))
    throw new Error('Invalid IGV API resource');
  const [endpoint, query] = value.split('?');
  return apiResourceURL(endpoint, Object.fromEntries(new URLSearchParams(query)));
}
