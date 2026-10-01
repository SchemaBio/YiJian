import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { literal } from './parquet-browser-sql';
/** Bound worker startup; DuckDB can leave CSP compilation failures pending. */
export function awaitWorkerStartup(worker: Worker, initialize: (progress: () => void) => Promise<unknown>, signal: AbortSignal, timeoutMs = 45000): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(timer); clearTimeout(totalTimer); worker.removeEventListener('error', failed); worker.removeEventListener('messageerror', failed); signal.removeEventListener('abort', aborted); };
    const failed = () => { cleanup(); reject(new Error('浏览器查询引擎启动失败，请刷新页面重试')); };
    const aborted = () => { cleanup(); reject(new DOMException('请求已取消', 'AbortError')); };
    const timedOut = () => { cleanup(); reject(new Error('浏览器查询引擎启动超时，请刷新页面并检查网络或浏览器安全限制')); };
    const progress = () => { clearTimeout(timer); timer = setTimeout(timedOut, timeoutMs); };
    const totalTimer = setTimeout(timedOut, Math.max(timeoutMs, 180000));
    progress();
    worker.addEventListener('error', failed); worker.addEventListener('messageerror', failed); signal.addEventListener('abort', aborted, {once:true});
    if (signal.aborted) { aborted(); return; }
    Promise.resolve().then(() => initialize(progress)).then(() => { cleanup(); resolve(); }, error => { cleanup(); reject(error); });
  });
}

/** Load the pinned signed extensions from our own origin, then forbid autoload. */
export async function configureBrowserRuntime(conn: Pick<AsyncDuckDBConnection, 'query'>, origin: string): Promise<void> {
  const repository = new URL('/duckdb/extensions', origin).href;
  await conn.query(`SET memory_limit='512MB'; SET threads=1; SET custom_extension_repository=${literal(repository)}; LOAD parquet; LOAD json; SET autoinstall_known_extensions=false; SET autoload_known_extensions=false`);
}
