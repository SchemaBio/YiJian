import { NextResponse, type NextRequest } from 'next/server';

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...Array.from(bytes)));
}

function apiConnectSource() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || apiUrl.startsWith('/')) return '';
  try {
    return new URL(apiUrl).origin;
  } catch {
    return '';
  }
}

function contentSecurityPolicy(nonce: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  const scriptSrc = isProduction
    ? [`'self'`, `'nonce-${nonce}'`]
    : [`'self'`, `'nonce-${nonce}'`, `'unsafe-inline'`, `'unsafe-eval'`];
  const connectSrc = [`'self'`, apiConnectSource(), 'http://localhost:*', 'http://backend:*']
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
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');
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
