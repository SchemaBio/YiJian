import { afterEach, expect, it, vi } from 'vitest';
import { getIGVSession, getIGVTrackURLs, getIGVSnapshot, saveIGVSnapshot } from './result-api';
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
it('resolves self-hosted reference, track and snapshot URLs against the configured API host', async () => {
  window.__YIJIAN_CONFIG__ = { API_URL: 'http://localhost:8080/api', BACKEND: 'octopus' };
  const root='/v1/tasks/task/results/igv';
  const replies=[
    {transport:'api',reference:{fastaURL:root+'/reference/fasta?attempt=a',indexURL:root+'/reference/fai?attempt=a'},tracks:[]},
    {transport:'api',tracks:[{id:'bam:0',url:root+'/tracks/bam:0/data?attempt=a&version=v',indexURL:root+'/tracks/bam:0/index?attempt=a&version=v'}]},
    {transport:'api',available:true,url:root+'/snapshot/file?locus=chr1%3A1-20&attempt=a&version=v'},
  ];
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(JSON.stringify({data:replies.shift()}))));
  const session=await getIGVSession('task');
  expect(session.reference.fastaURL).toBe('http://localhost:8080/api'+root+'/reference/fasta?attempt=a');
  expect(session.reference.indexURL).toBe('http://localhost:8080/api'+root+'/reference/fai?attempt=a');
  const signed=await getIGVTrackURLs('task','v',['bam:0']);
  expect(signed.tracks[0].url).toBe('http://localhost:8080/api'+root+'/tracks/bam:0/data?attempt=a&version=v');
  expect(signed.tracks[0].indexURL).toContain('http://localhost:8080/api'+root+'/tracks/bam:0/index?');
  expect((await getIGVSnapshot('task','chr1:1-20')).url).toContain('http://localhost:8080/api'+root+'/snapshot/file?');
});
it('keeps SaaS signed track URLs unchanged',async()=>{
  window.__YIJIAN_CONFIG__={API_URL:'/api',BACKEND:'squid'};
  const response={tracks:[{id:'bam:0',url:'https://objects.example/bam?signature=signed',indexURL:'https://objects.example/bai?signature=signed'}],expiresAt:'later'};
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:response})));
  vi.stubGlobal('fetch',fetch);
  expect(await getIGVTrackURLs('task','v',['bam:0'])).toEqual(response);
  expect(fetch).toHaveBeenCalledWith('/api/v1/octopus/tasks/task/results/igv/urls',expect.objectContaining({credentials:'include'}));
});
it.each(['https://evil.example/file','/v1/tasks/other/results/igv/reference/fai?attempt=a','/v1/tasks/task/results/igv/../../secret'])('rejects an unsafe local IGV resource: %s',async(url)=>{
  window.__YIJIAN_CONFIG__={API_URL:'/api',BACKEND:'octopus'};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{transport:'api',reference:{fastaURL:url},tracks:[]}}))));
  await expect(getIGVSession('task')).rejects.toThrow();
});
