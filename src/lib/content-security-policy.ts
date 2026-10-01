function apiConnectSource() {
  const apiUrl = process.env.YIJIAN_API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || apiUrl.startsWith('/')) return '';
  if (apiUrl.startsWith('//') || apiUrl.includes('\\') || /[\u0000-\u001f]/.test(apiUrl)) return '';
  try {
    const parsed = new URL(apiUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (parsed.username || parsed.password) return '';
    if (hasUnsafePathSegment(parsed.pathname)) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

function decodePathSegment(segment: string): string | null {
  let decoded = segment;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return decoded;
      decoded = next;
    } catch {
      return null;
    }
  }
  return decoded;
}

function hasUnsafePathSegment(path: string): boolean {
  for (const segment of path.split('/').filter(Boolean)) {
    const decoded = decodePathSegment(segment);
    if (
      decoded === null ||
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      /[\u0000-\u001f\u007f]/.test(decoded)
    ) {
      return true;
    }
  }
  return false;
}

export function contentSecurityPolicy(nonce: string, duckdbWorker = false) {
  const isProduction = process.env.NODE_ENV === 'production';
  const scriptSrc = isProduction
    ? [`'self'`, `'nonce-${nonce}'`, `'wasm-unsafe-eval'`, ...(duckdbWorker ? ["'unsafe-eval'"] : [])]
    : [`'self'`, `'nonce-${nonce}'`, `'unsafe-inline'`, `'unsafe-eval'`];
  const connectSrc = [
    `'self'`,
    apiConnectSource(),
    ...uploadConnectSources(),
    ...(isProduction ? [] : ['http://localhost:*', 'http://backend:*']),
  ]
    .filter(Boolean)
    .join(' ');

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src ${connectSrc}`,
    `worker-src 'self' blob:`,
    `frame-src 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');
}

function uploadConnectSources(): string[] {
  return (process.env.YIJIAN_UPLOAD_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        const parsed = new URL(value);
        if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) return [];
        return [parsed.origin];
      } catch {
        return [];
      }
    });
}


// Only these immutable, self-hosted Emscripten workers require generated JS.
// Never grant the worker exception to pages, arbitrary scripts or path prefixes.
export function isDuckDBWorkerPath(path: string): boolean {
  return ['/duckdb/duckdb-browser-eh.worker.js', '/duckdb/duckdb-browser-mvp.worker.js', '/duckdb/1.32.0-csp2/duckdb-browser-eh.worker.js', '/duckdb/1.32.0-csp2/duckdb-browser-mvp.worker.js'].includes(path);
}
