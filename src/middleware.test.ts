// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {contentSecurityPolicy,isDuckDBWorkerPath} from './lib/content-security-policy';
import {config} from './middleware';
afterEach(()=>vi.unstubAllEnvs());
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
