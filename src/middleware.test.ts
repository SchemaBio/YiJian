// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {contentSecurityPolicy,isDuckDBWorkerPath} from './lib/content-security-policy';
import {config,middleware} from './middleware';
import {NextRequest} from 'next/server';
import {checkTaskDetailAccess} from './lib/task-detail-access';
vi.mock('./lib/task-detail-access',()=>({checkTaskDetailAccess:vi.fn()}));
afterEach(()=>vi.unstubAllEnvs());
it.each(['zh-CN', 'zh-Hant', 'en', 'es-419'])('localizes unavailable tasks with the %s preference', async locale => {
 vi.mocked(checkTaskDetailAccess).mockResolvedValue('unavailable');
 vi.stubEnv('YIJIAN_DEFAULT_LOCALE', 'en');
 const response = await middleware(new NextRequest('https://yijian.example/tasks/00000000-0000-0000-0000-000000000001', {headers: {cookie: `access_token=test; yijian-locale=${locale}`}}));
 expect(response.status).toBe(503);
 expect(response.headers.get('Content-Language')).toBe(locale);
 expect(await response.text()).toBeTruthy();
});
it('permits the local WASM engine in production without JavaScript eval',()=>{
 vi.stubEnv('NODE_ENV','production');
 const csp=contentSecurityPolicy('test-nonce');
 expect(csp).toContain("'wasm-unsafe-eval'");
 expect(csp).not.toContain("'unsafe-eval'");
 expect(csp).not.toContain("script-src 'unsafe-inline'");
 expect(csp).toContain("worker-src 'self' blob:");
 expect(csp).toContain("script-src 'self' 'nonce-test-nonce'");
 expect(config.matcher[0]).not.toContain('duckdb');
});

it('isolates Emscripten generated JavaScript permission to the two DuckDB workers',()=>{
 vi.stubEnv('NODE_ENV','production');
 for(const path of ['/duckdb/duckdb-browser-eh.worker.js','/duckdb/duckdb-browser-mvp.worker.js','/duckdb/1.32.0-csp2/duckdb-browser-eh.worker.js','/duckdb/1.32.0-csp2/duckdb-browser-mvp.worker.js']) {
  expect(isDuckDBWorkerPath(path)).toBe(true);
  expect(contentSecurityPolicy('nonce',isDuckDBWorkerPath(path))).toContain("'unsafe-eval'");
 }
 for(const path of ['/tasks/task','/login','/duckdb/other.js','/duckdb/duckdb-browser-eh.worker.js/extra','/duckdb/other-version/duckdb-browser-eh.worker.js']) {
  expect(isDuckDBWorkerPath(path)).toBe(false);
  expect(contentSecurityPolicy('nonce',isDuckDBWorkerPath(path))).not.toContain("'unsafe-eval'");
 }
});

it('returns HTTP 404 before rendering a calibration report, including tab URLs',async()=>{
 vi.mocked(checkTaskDetailAccess).mockResolvedValue('not_found');
 const r=await middleware(new NextRequest('https://yijian.example/tasks/a09e825c-d944-4a6e-99f3-20ea35d0e2de?tab=report',{headers:{cookie:'access_token=test-session'}}));
 expect(r.status).toBe(404);
 expect(r.headers.get('x-middleware-rewrite')).toBe('https://yijian.example/404');
 expect(r.headers.get('cache-control')).toContain('no-store');
});
it('permits ordinary analysis pages and leaves non-detail routes alone',async()=>{
 vi.mocked(checkTaskDetailAccess).mockResolvedValue('allowed');
 const r=await middleware(new NextRequest('https://yijian.example/tasks/00000000-0000-0000-0000-000000000001',{headers:{cookie:'access_token=test-session'}}));
 expect(r.status).toBe(200);
 expect(r.headers.get('x-middleware-next')).toBe('1');
 vi.mocked(checkTaskDetailAccess).mockClear();
 expect((await middleware(new NextRequest('https://yijian.example/tasks/new'))).status).toBe(200);
 expect(checkTaskDetailAccess).not.toHaveBeenCalled();
});
