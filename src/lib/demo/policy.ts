export const DEMO_VERSION = 'hg002-myh3-20261117-v1';
export const DEMO_BASE = `/demo/${DEMO_VERSION}/`;
export const DEMO_MANIFEST = `${DEMO_BASE}manifest.json`;
export const DEMO_ENGINE = '/demo-engine/1.32.0/';

export function isDemoWorkerPath(path: string) {
  return path === `${DEMO_ENGINE}duckdb-browser-eh.worker.js` || path === `${DEMO_ENGINE}duckdb-browser-mvp.worker.js`;
}

export function isDemoPath(path: string) {
  return path === '/demo' || path.startsWith('/demo/');
}

/** Path-scoped connections also exclude same-origin /api and runtime config. */
export function demoContentSecurityPolicy(nonce: string, origin: string, worker = false) {
  const host = new URL(origin).origin;
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'${worker || process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'",
    `connect-src ${host}${DEMO_BASE} ${host}/duckdb/1.32.0-csp2/ ${host}/duckdb/extensions/`,
    `worker-src ${host}${DEMO_ENGINE}`,
    "frame-src 'none'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join('; ');
}
