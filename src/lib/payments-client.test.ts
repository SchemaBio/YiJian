import { afterEach, expect, it, vi } from 'vitest';
import { getPaymentOrders } from './payments';

afterEach(() => vi.unstubAllGlobals());
it('requests paginated orders through the real API client', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { items: [], total: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  await expect(getPaymentOrders(2)).resolves.toEqual({ items: [], total: 0 });
  expect(fetcher).toHaveBeenCalledWith('/api/v1/billing/orders?page=2', expect.anything());
});
