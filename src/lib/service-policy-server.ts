import { getRuntimeApiBaseUrl, getRuntimeBackendFlavor } from './runtime-config';
import type { ServicePolicy } from './service-policy';

// Render public operator details into HTML for payment reviewers and crawlers.
// Never build an upstream URL from the incoming Host header or forward credentials.
export async function getServerServicePolicy(): Promise<ServicePolicy | null> {
  if (getRuntimeBackendFlavor() !== 'squid') return null;
  const configured = process.env.YIJIAN_SERVER_API_URL || getRuntimeApiBaseUrl();
  const base = /^https?:\/\//.test(configured) ? configured.replace(/\/+$/, '')
    : `http://${process.env.NODE_ENV === 'production' ? 'squid' : '127.0.0.1'}:8080${configured || '/api'}`;
  try {
    const response = await fetch(`${base}/v1/service-policy`, { cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const body = await response.json(); const value = body.data ?? body;
    if (!value || typeof value.version !== 'string' || typeof value.configured !== 'boolean' ||
      !['operator', 'contact', 'address', 'service_url', 'terms_url', 'refund_url'].every(key => typeof value[key] === 'string')) return null;
    return value as ServicePolicy;
  } catch { return null; }
}
