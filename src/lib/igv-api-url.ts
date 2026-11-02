import {apiResourceURL} from './api';

export function igvAPIURL(taskId: string, value: string): string {
  if (!value.startsWith(`/v1/tasks/${encodeURIComponent(taskId)}/results/igv/`) || value.includes('#'))
    throw new Error('Invalid IGV API resource');
  const [endpoint, query] = value.split('?');
  return apiResourceURL(endpoint, Object.fromEntries(new URLSearchParams(query)));
}

export function igvReferenceURL(taskId: string, value: string): string {
  // Older servers emitted an absolute URL using a configured public domain.
  // Resolve only recognized task reference routes locally; external reference
  // providers and signed object-store URLs retain their configured URLs.
  const url = new URL(value, 'http://igv.local');
  const suffix = `/tasks/${encodeURIComponent(taskId)}/results/igv/reference/`;
  if (['/v1', '/api/v1', '/api/v1/octopus'].some(prefix =>
    ['fasta', 'fai'].some(asset => url.pathname === prefix + suffix + asset))) {
    if (url.hash) throw new Error('Invalid IGV API resource');
    return igvAPIURL(taskId, '/v1' + url.pathname.slice(url.pathname.indexOf('/tasks/')) + url.search);
  }
  return value;
}
