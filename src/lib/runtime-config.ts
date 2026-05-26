declare global {
  interface Window {
    __YIJIAN_CONFIG__?: {
      API_URL?: string;
    };
  }
}

export function getRuntimeApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const runtimeValue = window.__YIJIAN_CONFIG__?.API_URL;
    if (runtimeValue) return runtimeValue;
  }
  return process.env.NEXT_PUBLIC_API_URL || '/api';
}

export {};
