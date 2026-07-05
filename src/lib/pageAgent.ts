/**
 * Page Agent Wrapper
 * LLM calls are proxied through the backend (no API key on frontend).
 */
import type { AIConfig } from '@/types/ai';
import { getRuntimeApiBaseUrl } from './runtime-config';

let PageAgentClass: typeof import('page-agent').PageAgent | null = null;

async function loadPageAgent(): Promise<typeof import('page-agent').PageAgent> {
  if (PageAgentClass) return PageAgentClass;
  const module = await import('page-agent');
  PageAgentClass = module.PageAgent;
  return PageAgentClass;
}

function getProxyBaseURL(): string {
  if (typeof window === 'undefined') return '/api/v1/ai/proxy';
  const apiBase = getRuntimeApiBaseUrl();
  if (apiBase.startsWith('http')) {
    return `${apiBase}/v1/ai/proxy`;
  }
  return `${window.location.origin}${apiBase}/v1/ai/proxy`;
}

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

function assertAIProxyRequest(input: RequestInfo | URL): void {
  if (typeof window === 'undefined') return;

  const rawURL = typeof Request !== 'undefined' && input instanceof Request ? input.url : input.toString();
  const requestURL = new URL(rawURL, window.location.origin);
  const proxyURL = new URL(getProxyBaseURL());
  const proxyPath = proxyURL.pathname.replace(/\/+$/, '');
  const isProxyPath = requestURL.pathname === proxyPath || requestURL.pathname.startsWith(`${proxyPath}/`);

  if (requestURL.origin !== proxyURL.origin || !isProxyPath) {
    throw new Error('AI proxy request blocked: unexpected destination');
  }
}

async function refreshCookieSession(signal?: AbortSignal): Promise<boolean> {
  const csrfToken = getCookie('csrf_token');
  try {
    const response = await fetch(`${getRuntimeApiBaseUrl()}/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: JSON.stringify({}),
      signal,
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function squidAIProxyFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  assertAIProxyRequest(input);

  const headers = new Headers(init.headers);
  // Squid authenticates protected SaaS routes from the access_token cookie. The
  // OpenAI-compatible client may add a dummy Authorization header; remove it so
  // JWTAuth does not reject the request before checking cookies.
  headers.delete('Authorization');

  const csrfToken = getCookie('csrf_token');
  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
    credentials: 'include',
  };

  let response = await fetch(input, requestInit);
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshCookieSession(init.signal ?? undefined);
  if (!refreshed) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('schema:auth-expired'));
    }
    return response;
  }

  return fetch(input, requestInit);
}

export class PageAgentWrapper {
  private agent: import('page-agent').PageAgent | null = null;
  private config: AIConfig;
  private initialized = false;

  constructor(config: AIConfig) {
    this.config = config;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const PageAgent = await loadPageAgent();
      const baseURL = getProxyBaseURL();

      this.agent = new PageAgent({
        model: this.config.openaiModel || 'gpt-4',
        baseURL,
        apiKey: '', // real LLM key is added by Squid; frontend authenticates via cookies
        customFetch: squidAIProxyFetch,
        language: 'zh-CN',
      });
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize PageAgent:', error);
      throw error;
    }
  }

  async execute(command: string): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
      await this.init();

      if (!this.agent) {
        return { success: false, error: 'PageAgent 未初始化' };
      }

      const result = await this.agent.execute(command);

      return {
        success: true,
        result: typeof result === 'string' ? result : JSON.stringify(result),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('PageAgent execution error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  reset(): void {
    this.agent = null;
    this.initialized = false;
  }
}

export function createPageAgent(config: AIConfig): PageAgentWrapper {
  return new PageAgentWrapper(config);
}
