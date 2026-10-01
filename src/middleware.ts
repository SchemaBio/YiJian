import { contentSecurityPolicy, isDuckDBWorkerPath } from './lib/content-security-policy';
import { NextResponse, type NextRequest } from 'next/server';

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...Array.from(bytes)));
}

export function middleware(request: NextRequest) {
  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce, isDuckDBWorkerPath(request.nextUrl.pathname));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('Content-Security-Policy', csp);
  if (/^\/duckdb\/1\.32\.0-csp2\/(duckdb-(eh|mvp)\.wasm|duckdb-browser-(eh|mvp)\.worker\.js)$/.test(request.nextUrl.pathname)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
