declare global {
  interface Window {
    __YIJIAN_CONFIG__?: {
      API_URL?: string;
      CORE_API_PREFIX?: string;
      BACKEND_FLAVOR?: 'octopus' | 'squid' | 'auto';
      SUPPORT_EMAIL?: string;
    };
  }
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith('//') || trimmed.includes('\\') || /[\u0000-\u001f]/.test(trimmed)) {
    return fallback;
  }

  if (trimmed.startsWith('/')) {
    const pathOnly = trimmed.split(/[?#]/, 1)[0];
    if (hasUnsafePathSegment(pathOnly)) {
      return fallback;
    }
    return pathOnly === '/' ? '' : pathOnly.replace(/\/+$/, '');
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallback;
    }
    if (parsed.username || parsed.password) {
      return fallback;
    }
    if (hasUnsafePathSegment(parsed.pathname)) {
      return fallback;
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

function normalizePathPrefix(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '/') return '';
  if (
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    /[?#]/.test(trimmed) ||
    /[\u0000-\u001f]/.test(trimmed) ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return '';
  }
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function hasUnsafePathSegment(path: string): boolean {
  if (path.includes('\\') || /[\u0000-\u001f]/.test(path)) return true;
  const segments = path.split('/').filter(Boolean);
  for (const segment of segments) {
    const decoded = decodePathSegment(segment);
    if (decoded === null) {
      return true;
    }
    if (
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      /[\u0000-\u001f]/.test(decoded)
    ) {
      return true;
    }
  }
  return false;
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

function normalizeSafePathPrefix(value: string | undefined): string {
  const prefix = normalizePathPrefix(value);
  return prefix && hasUnsafePathSegment(prefix) ? '' : prefix;
}

export function getRuntimeApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const runtimeValue = window.__YIJIAN_CONFIG__?.API_URL;
    if (runtimeValue) return normalizeBaseUrl(runtimeValue, '/api');
  }
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL, '/api');
}

export function getRuntimeCoreApiPrefix(): string {
  if (typeof window !== 'undefined') {
    return normalizeSafePathPrefix(window.__YIJIAN_CONFIG__?.CORE_API_PREFIX);
  }
  return normalizeSafePathPrefix(process.env.NEXT_PUBLIC_CORE_API_PREFIX);
}

export function getRuntimeBackendFlavor(): 'octopus' | 'squid' | 'auto' {
  const value = typeof window !== 'undefined'
    ? window.__YIJIAN_CONFIG__?.BACKEND_FLAVOR
    : process.env.NEXT_PUBLIC_BACKEND_FLAVOR;
  return value === 'octopus' || value === 'squid' ? value : 'auto';
}

export function getRuntimeSupportEmail(): string {
  const value = typeof window !== 'undefined'
    ? window.__YIJIAN_CONFIG__?.SUPPORT_EMAIL
    : process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : 'support@schemabio.com';
}

export {};
