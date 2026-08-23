import { STORAGE_KEYS } from './storage';
import { getRuntimeApiBaseUrl, getRuntimeBackendFlavor, getRuntimeCoreApiPrefix } from './runtime-config';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
  /** Internal escape hatch for SaaS-only endpoints that must not be routed through Squid's Octopus proxy. */
  coreApi?: boolean;
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
  if (!item) return null;
  try {
    return decodeURIComponent(item.slice(prefix.length));
  } catch {
    return null;
  }
}

function isUnsafeMethod(method?: string): boolean {
  const normalized = (method || 'GET').toUpperCase();
  return !['GET', 'HEAD', 'OPTIONS'].includes(normalized);
}

const CORE_API_PREFIX_FALLBACK = '/v1/octopus';
const CORE_API_ROOTS = [
  'tasks',
  'samples',
  'pipelines',
  'templates',
  'report-templates',
  'gene-lists',
  'archive',
  'history',
  'dashboard',
  'projects',
  'pedigrees',
  'upload',
  'data',
	'cnv-baselines',
];

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

function hasUnsafeEndpointPathSegment(endpoint: string): boolean {
  for (const segment of endpoint.split('/').filter(Boolean)) {
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

function assertRelativeAPIEndpoint(endpoint: string): string {
  if (!endpoint.startsWith('/')) {
    throw new Error(`API endpoint must start with "/": ${endpoint}`);
  }
  if (
    endpoint.startsWith('//') ||
    endpoint.includes('\\') ||
    /[\u0000-\u001f]/.test(endpoint) ||
    /[?#]/.test(endpoint) ||
    /^[a-z][a-z0-9+.-]*:/i.test(endpoint) ||
    hasUnsafeEndpointPathSegment(endpoint)
  ) {
    throw new Error(`API endpoint must be relative: ${endpoint}`);
  }
  return endpoint;
}

function isCoreEndpoint(endpoint: string): boolean {
  const normalized = assertRelativeAPIEndpoint(endpoint);
  return CORE_API_ROOTS.some(root => normalized === `/v1/${root}` || normalized.startsWith(`/v1/${root}/`));
}

function withCorePrefix(endpoint: string, prefix = getRuntimeCoreApiPrefix(), coreApi = true): string {
  const normalized = assertRelativeAPIEndpoint(endpoint);
  if (coreApi === false) return normalized;
  if (!prefix || !isCoreEndpoint(normalized)) return normalized;
  const cleanPrefix = prefix.replace(/\/+$/, '');
  return `${cleanPrefix}${normalized.replace(/^\/v1(?=\/|$)/, '')}`;
}

function shouldRetryViaSquidOctopus(endpoint: string, response: Response, coreApi?: boolean): boolean {
  const backendFlavor = getRuntimeBackendFlavor();
  return response.status === 404
    && coreApi !== false
    && backendFlavor !== 'octopus'
    && !getRuntimeCoreApiPrefix()
    // This compatibility branch is unreachable with the canonical explicit
    // backend configuration, but remains defensive for stale runtime files.
    && isCoreEndpoint(endpoint);
}

function appendQuery(url: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return url;
  const searchParams = new URLSearchParams(params);
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${searchParams.toString()}`;
}

function buildURL(endpoint: string, params?: Record<string, string>, prefix?: string, coreApi = true): string {
  return appendQuery(`${getRuntimeApiBaseUrl()}${withCorePrefix(endpoint, prefix, coreApi)}`, params);
}

async function parseJSONBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrapResponse<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data?: T }).data as T;
  }
  return json as T;
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
      clearAuthSession();
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
  const { params, coreApi, ...init } = options;
  const url = buildURL(endpoint, params, undefined, coreApi);

  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (isUnsafeMethod(init.method)) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  let response = await fetch(url, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  });

  if (shouldRetryViaSquidOctopus(endpoint, response, coreApi)) {
    response = await fetch(buildURL(endpoint, params, CORE_API_PREFIX_FALLBACK), {
      ...init,
      headers,
      credentials: init.credentials ?? 'include',
    });
  }

  // Auto-refresh on 401 (skip for auth endpoints to avoid loops). This runs
  // after Squid /v1/octopus fallback too, because expired sessions usually
  // surface from the proxied core endpoint rather than the first /v1/* probe.
  if (response.status === 401 && !endpoint.startsWith('/v1/auth/')) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await fetch(url, {
        ...init,
        headers,
        credentials: init.credentials ?? 'include',
      });
      if (shouldRetryViaSquidOctopus(endpoint, response, coreApi)) {
        response = await fetch(buildURL(endpoint, params, CORE_API_PREFIX_FALLBACK), {
          ...init,
          headers,
          credentials: init.credentials ?? 'include',
        });
      }
    } else {
      // Refresh failed; trigger logout by dispatching event.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('schema:auth-expired'));
      }
      throw new ApiError(401, 'Unauthorized', { error: 'Token expired and refresh failed' });
    }
  }

  if (!response.ok) {
    const data = await parseJSONBody(response);
    throw new ApiError(response.status, response.statusText, data);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  // Backend wraps most responses as { data: T }; keep raw JSON compatible too.
  return unwrapResponse<T>(await parseJSONBody(response));
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
  const clean = (value: string) => value
    .trim()
    .replace(/[\\/]/g, '-')
    .replace(/[\u0000-\u001f\u007f]/g, '');
  const cleaned = clean(name);
  if (cleaned && cleaned !== '.' && cleaned !== '..') return cleaned;
  const cleanedFallback = clean(fallback);
  return cleanedFallback && cleanedFallback !== '.' && cleanedFallback !== '..'
    ? cleanedFallback
    : 'download.bin';
}

async function errorData(response: Response): Promise<unknown> {
  const data = await parseJSONBody(response).catch(() => null);
  return typeof data === 'string' ? { error: data } : data;
}

async function requestDownload(
  endpoint: string,
  options: RequestOptions = {},
  fallbackFilename = 'download.bin'
): Promise<DownloadResult> {
  const { params, coreApi, ...init } = options;
  const url = buildURL(endpoint, params, undefined, coreApi);

  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (isUnsafeMethod(init.method)) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const doFetch = (requestURL = url) => fetch(requestURL, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  });

  let response = await doFetch();
  if (shouldRetryViaSquidOctopus(endpoint, response, coreApi)) {
    response = await doFetch(buildURL(endpoint, params, CORE_API_PREFIX_FALLBACK));
  }
  if (response.status === 401 && !endpoint.startsWith('/v1/auth/')) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await doFetch();
      if (shouldRetryViaSquidOctopus(endpoint, response, coreApi)) {
        response = await doFetch(buildURL(endpoint, params, CORE_API_PREFIX_FALLBACK));
      }
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
  job_id: string;
  file_id: string;
  upload_url: string;
  storage_type: string;
}

interface UploadJobFile {
  id: string;
  file_name?: string;
  read_type?: 'read1' | 'read2' | 'single' | 'bed';
  presigned_url?: string;
}

interface UploadJobResponse {
  id: string;
  files?: UploadJobFile[];
}

function backendUploadURL(fileID: string): string {
  const configuredPrefix = getRuntimeCoreApiPrefix();
  const prefix = configuredPrefix || (getRuntimeBackendFlavor() === 'squid' ? CORE_API_PREFIX_FALLBACK : '');
  return `${getRuntimeApiBaseUrl()}${withCorePrefix(`/v1/upload/local/${encodeURIComponent(fileID)}`, prefix)}`;
}

function isBackendLocalUploadURL(uploadURL: string): boolean {
  try {
    const url = new URL(uploadURL, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return /\/v1\/(?:octopus\/)?upload\/local\//.test(url.pathname) && isAllowedBackendOrigin(url);
  } catch {
    return false;
  }
}

function isAbsoluteHTTPURL(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function allowedBackendOrigins(): Set<string> {
  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const origins = new Set<string>([fallbackOrigin]);
  try {
    origins.add(new URL(getRuntimeApiBaseUrl(), fallbackOrigin).origin);
  } catch {
    // Ignore malformed runtime values here; runtime-config normalization already falls back safely.
  }
  return origins;
}

function isAllowedBackendOrigin(url: URL): boolean {
  return allowedBackendOrigins().has(url.origin);
}

function squidFallbackLocalUploadURL(uploadURL: string): string | null {
  if (getRuntimeBackendFlavor() === 'octopus' || getRuntimeCoreApiPrefix()) return null;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(uploadURL, base);
    if (!/\/v1\/upload\/local\//.test(url.pathname)) return null;
    url.pathname = url.pathname.replace('/v1/upload/local/', '/v1/octopus/upload/local/');
    return url.toString();
  } catch {
    return null;
  }
}

export async function requestPresignedUploadUrl(
  filename: string,
  fileSize: number,
  readType: 'read1' | 'read2' | 'single' | 'bed' = 'single',
  referenceGenome?: 'GRCh37' | 'GRCh38',
  uploadPolicyAcknowledged = false,
  internalId?: string
): Promise<PresignedUploadResult> {
  const fileType = readType === 'bed'
    ? 'bed'
    : readType === 'single'
      ? 'fastq_single'
      : 'fastq_paired';
  const job = await api.post<UploadJobResponse>('/v1/upload/jobs', {
    name: filename,
	...(internalId?.trim() ? { internal_id: internalId.trim() } : {}),
    file_type: fileType,
    ...(readType === 'bed' && referenceGenome ? { reference_genome: referenceGenome } : {}),
    provider: 'local',
    upload_policy_acknowledged: uploadPolicyAcknowledged,
    files: [{
      file_name: filename,
      read_type: readType,
      file_size: fileSize,
    }],
  });
  const file = job.files?.[0];
  if (!file?.id) {
    throw new Error('Upload job did not return a file id');
  }
  return {
    job_id: job.id,
    file_id: file.id,
    upload_url: file.presigned_url || backendUploadURL(file.id),
    storage_type: file.presigned_url ? 'presigned' : 'local',
  };
}

export interface PairedUploadJobResult {
  job_id: string;
  files: Array<PresignedUploadResult & { read_type: 'read1' | 'read2' }>;
}

export async function requestPairedUploadJob(r1: File, r2: File, uploadPolicyAcknowledged: boolean, sampleId?: string, internalId?: string): Promise<PairedUploadJobResult> {
  const job = await api.post<UploadJobResponse>('/v1/upload/jobs', {
    ...(sampleId ? { sample_id: sampleId } : {}),
	...(internalId?.trim() ? { internal_id: internalId.trim() } : {}),
    name: `${r1.name} + ${r2.name}`,
    file_type: 'fastq_paired',
    provider: 'local',
    upload_policy_acknowledged: uploadPolicyAcknowledged,
    files: [
      {
        file_name: r1.name,
        read_type: 'read1',
        file_size: r1.size,
      },
      {
        file_name: r2.name,
        read_type: 'read2',
        file_size: r2.size,
      },
    ],
  });

  const files = job.files ?? [];
  const byReadType = new Map(files.map((file, index) => [file.read_type || (index === 0 ? 'read1' : 'read2'), file]));
  const r1File = byReadType.get('read1');
  const r2File = byReadType.get('read2');
  if (!job.id || !r1File?.id || !r2File?.id) {
    throw new Error('Upload job did not return both R1 and R2 file ids');
  }

  const normalizeFile = (file: UploadJobFile, readType: 'read1' | 'read2') => ({
    job_id: job.id,
    file_id: file.id,
    upload_url: file.presigned_url || backendUploadURL(file.id),
    storage_type: file.presigned_url ? 'presigned' : 'local',
    read_type: readType,
  });

  return {
    job_id: job.id,
    files: [normalizeFile(r1File, 'read1'), normalizeFile(r2File, 'read2')],
  };
}

class UploadError extends Error {
  constructor(public status: number, message = `Upload failed: ${status}`) {
    super(message);
    this.name = 'UploadError';
  }
}

function normalizeUploadURL(uploadURL: string): string {
  if (/[\u0000-\u001f]/.test(uploadURL)) {
    throw new Error('Invalid upload URL');
  }

  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL(uploadURL, base);
  const isLocalUpload = isBackendLocalUploadURL(uploadURL);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported upload URL scheme: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error('Upload URL must not include credentials');
  }
  if (!isLocalUpload && !isAbsoluteHTTPURL(uploadURL)) {
    throw new Error('Presigned upload URL must be absolute');
  }
  if (!isLocalUpload && isAllowedBackendOrigin(url)) {
    throw new Error('Refusing to upload to a non-upload backend endpoint');
  }
  url.hash = '';
  return url.toString();
}

function uploadFileOnce(uploadURL: string, file: File, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const safeUploadURL = normalizeUploadURL(uploadURL);
    const isLocalUpload = isBackendLocalUploadURL(safeUploadURL);
    xhr.open(isLocalUpload ? 'POST' : 'PUT', safeUploadURL);
    if (!isLocalUpload) {
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    } else {
      xhr.withCredentials = true;
      const csrfToken = getCookie('csrf_token');
      if (csrfToken) {
        xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      }
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new UploadError(xhr.status));
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    if (isLocalUpload) {
      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    } else {
      xhr.send(file);
    }
  });
}

export async function uploadToCOS(presignedUrl: string, file: File, onProgress?: (pct: number) => void) {
  try {
    await uploadFileOnce(presignedUrl, file, onProgress);
  } catch (err) {
    const fallbackURL = isBackendLocalUploadURL(presignedUrl) ? squidFallbackLocalUploadURL(presignedUrl) : null;
    if (fallbackURL && err instanceof UploadError && err.status === 404) {
      await uploadFileOnce(fallbackURL, file, onProgress);
      return;
    }
    throw err;
  }
}

export async function confirmUpload(fileId: string) {
  return api.post(`/v1/upload/files/${encodeURIComponent(fileId)}/complete`, {});
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
  }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),

  download: (endpoint: string, data?: unknown, options?: RequestOptions & { fallbackFilename?: string }) => {
    const { fallbackFilename, ...requestOptions } = options ?? {};
    return requestDownload(
      endpoint,
      {
        ...requestOptions,
        method: requestOptions.method ?? 'POST',
        body: data !== undefined ? JSON.stringify(data) : requestOptions.body,
      },
      fallbackFilename
    );
  },

  patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
