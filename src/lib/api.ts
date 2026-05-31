import { STORAGE_KEYS } from './storage';
import { getRuntimeApiBaseUrl } from './runtime-config';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

function clearLegacyAuthTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.LEGACY_AUTH_TOKENS);
}

function clearAuthSession() {
  if (typeof window === 'undefined') return;
  clearLegacyAuthTokens();
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.ORGANIZATIONS);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG);
}

export { ApiError, clearLegacyAuthTokens, clearAuthSession };

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const item = document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

function isUnsafeMethod(method?: string): boolean {
  const normalized = (method || 'GET').toUpperCase();
  return !['GET', 'HEAD', 'OPTIONS'].includes(normalized);
}

// Refresh lock: prevents concurrent cookie-backed session refresh calls.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  // If already refreshing, wait for that promise
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${getRuntimeApiBaseUrl()}/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getCookie('csrf_token') ? { 'X-CSRF-Token': getCookie('csrf_token') as string } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        clearAuthSession();
        return false;
      }

      await response.json().catch(() => null);
      clearLegacyAuthTokens();
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...init } = options;

  let url = `${getRuntimeApiBaseUrl()}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init.headers,
  };

  if (isUnsafeMethod(init.method)) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      (headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
    }
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  });

  // Auto-refresh on 401 (skip for auth endpoints to avoid loops)
  if (response.status === 401 && !endpoint.startsWith('/v1/auth/')) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retryResponse = await fetch(url, {
        ...init,
        headers,
        credentials: init.credentials ?? 'include',
      });
      if (!retryResponse.ok) {
        const retryData = await retryResponse.json().catch(() => null);
        throw new ApiError(retryResponse.status, retryResponse.statusText, retryData);
      }
      if (retryResponse.status === 204) return undefined as T;
      const retryJson = await retryResponse.json();
      return retryJson?.data ?? retryJson;
    }
    // Refresh failed; trigger logout by dispatching event.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('schema:auth-expired'));
    }
    throw new ApiError(401, 'Unauthorized', { error: 'Token expired and refresh failed' });
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, response.statusText, data);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  const json = await response.json();
  // Backend wraps all responses as { data: T }
  return json?.data ?? json;
}


export interface DownloadResult {
  blob: Blob;
  filename: string;
  contentType: string;
}

function filenameFromContentDisposition(contentDisposition: string | null): string {
  if (!contentDisposition) return '';
  const filenameStar = contentDisposition.match(/filename\*=([^;]+)/i)?.[1]?.trim();
  if (filenameStar) {
    const value = filenameStar.replace(/^UTF-8''/i, '').replace(/^"|"$/g, '');
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  const filename = contentDisposition.match(/filename=([^;]+)/i)?.[1]?.trim();
  return filename ? filename.replace(/^"|"$/g, '') : '';
}

function sanitizeFilename(name: string, fallback: string): string {
  const cleaned = name.trim().replace(/[\\/]/g, '-').replace(/[\u0000-\u001f]/g, '');
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : fallback;
}

async function errorData(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }
  const text = await response.text().catch(() => '');
  return text ? { error: text } : null;
}

async function requestDownload(
  endpoint: string,
  options: RequestOptions = {},
  fallbackFilename = 'download.bin'
): Promise<DownloadResult> {
  const { params, ...init } = options;

  let url = `${getRuntimeApiBaseUrl()}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init.headers,
  };

  if (isUnsafeMethod(init.method)) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      (headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
    }
  }

  const doFetch = () => fetch(url, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  });

  let response = await doFetch();
  if (response.status === 401 && !endpoint.startsWith('/v1/auth/')) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await doFetch();
    } else {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('schema:auth-expired'));
      }
      throw new ApiError(401, 'Unauthorized', { error: 'Token expired and refresh failed' });
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText, await errorData(response));
  }

  const blob = await response.blob();
  return {
    blob,
    filename: sanitizeFilename(
      filenameFromContentDisposition(response.headers.get('Content-Disposition')),
      fallbackFilename
    ),
    contentType: response.headers.get('Content-Type') || blob.type || 'application/octet-stream',
  };
}

// COS presigned URL upload flow
export interface PresignedUploadResult {
  file_id: number;
  upload_url: string;
  storage_key: string;
  storage_type: string;
}

export async function requestPresignedUploadUrl(filename: string, fileSize: number) {
  const res = await api.post<PresignedUploadResult>('/v1/files/presigned-url', { filename, file_size: fileSize });
  return res;
}

export async function uploadToCOS(presignedUrl: string, file: File, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`COS upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('COS upload network error'));
    xhr.send(file);
  });
}

export async function confirmUpload(fileId: number) {
  return api.post(`/v1/files/${fileId}/confirm`);
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  download: (endpoint: string, data?: unknown, options?: RequestOptions & { fallbackFilename?: string }) => {
    const { fallbackFilename, ...requestOptions } = options ?? {};
    return requestDownload(
      endpoint,
      {
        ...requestOptions,
        method: requestOptions.method ?? 'POST',
        body: data ? JSON.stringify(data) : requestOptions.body,
      },
      fallbackFilename
    );
  },

  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
