import { NextResponse, type NextRequest } from 'next/server';

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...Array.from(bytes)));
}

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

function contentSecurityPolicy(nonce: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  const scriptSrc = isProduction
    ? [`'self'`, `'nonce-${nonce}'`]
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

export function middleware(request: NextRequest) {
  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
