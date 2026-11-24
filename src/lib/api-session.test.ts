import { afterEach, expect, it, vi } from 'vitest';
import { api, SESSION_GENERATION_KEY } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem(SESSION_GENERATION_KEY);
  document.cookie = 'csrf_token=; Max-Age=0; Path=/';
});

it('rebuilds checkout headers after refresh without changing the purchase intent', async () => {
  document.cookie = 'csrf_token=initial; Path=/';
  const attempts: Headers[] = [];
  const bodies: unknown[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/auth/refresh')) {
      expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('initial');
      document.cookie = 'csrf_token=rotated; Path=/';
      return new Response('{}');
    }
    attempts.push(new Headers(init.headers));
    bodies.push(init.body);
    return attempts.length === 1 ? new Response(null, { status: 401 }) : new Response('{"data":"ok"}');
  });
  vi.stubGlobal('fetch', fetchMock);
  await expect(api.post('/v1/billing/checkout-sessions', { quantity: 3 }, { headers: { 'Idempotency-Key': 'purchase' } })).resolves.toBe('ok');
  expect(attempts.map(h => h.get('X-CSRF-Token'))).toEqual(['initial', 'rotated']);
  expect(attempts.map(h => h.get('Idempotency-Key'))).toEqual(['purchase', 'purchase']);
  expect(bodies[0]).toEqual(bodies[1]);
});

it.each([false, true])('handles a concurrent cookie rotation under the origin lock (account changed: %s)', async changed => {
  document.cookie = 'csrf_token=initial; Path=/';
  const request = vi.fn(async (_name: string, operation: () => Promise<unknown>) => {
    document.cookie = 'csrf_token=other-tab; Path=/';
    if (changed) localStorage.setItem(SESSION_GENERATION_KEY, 'other-login');
    return operation();
  });
  vi.stubGlobal('navigator', { locks: { request } });
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response('{"data":"ok"}'));
  vi.stubGlobal('fetch', fetchMock);
  const result = api.post('/v1/billing/checkout-sessions', { quantity: 2 });
  if (changed) {
    await expect(result).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } else {
    await expect(result).resolves.toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[0][0]);
  }
  expect(request).toHaveBeenCalledTimes(1);
});
