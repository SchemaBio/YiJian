import { afterEach, expect, it, vi } from 'vitest';
import { getIGVSnapshot, saveIGVSnapshot } from './result-api';
vi.mock('@/lib/parquet-browser', () => ({ queryBrowserParquet: vi.fn(), exportBrowserParquet: vi.fn(), updateBrowserOverlay: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); delete window.__YIJIAN_CONFIG__; });
it('routes snapshot parameters through the real SaaS API client', async () => {
  window.__YIJIAN_CONFIG__ = { API_URL: '/api', BACKEND: 'squid' };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { available: false } }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  expect(await getIGVSnapshot('task', 'chrX:10-110')).toEqual({ available: false });
  expect(fetch).toHaveBeenCalledWith('/api/v1/octopus/tasks/task/results/igv/snapshot?locus=chrX%3A10-110', expect.objectContaining({ cache: 'no-store', credentials: 'include' }));
});
it('uploads PNG through the real multipart API client', async () => {
  window.__YIJIAN_CONFIG__ = { API_URL: '/api', BACKEND: 'squid' };
  document.cookie = 'csrf_token=fixture';
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { available: true } }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  await saveIGVSnapshot('task', 'chr1:10-110', 'version', new Blob(['png'], { type: 'image/png' }));
  const [url, request] = fetch.mock.calls[0];
  expect(url).toBe('/api/v1/octopus/tasks/task/results/igv/snapshot');
  expect(request.body).toBeInstanceOf(FormData);
  expect(request.body.get('locus')).toBe('chr1:10-110');
  expect(request.body.get('image').type).toBe('image/png');
});
