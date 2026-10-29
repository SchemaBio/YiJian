import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout engine; page tests default to the desktop viewport.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true,
    value: (query: string) => ({ matches: false, media: query, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => true }),
  });
}

// Node 22 can expose an opaque-origin jsdom where localStorage is absent even
// when the test environment URL is configured. The upload provider's durable
// recovery behavior needs a tiny deterministic storage implementation in that
// case.
let browserStorage: Storage | undefined;
try {
  if (typeof window !== 'undefined') browserStorage = window.localStorage;
} catch {
  browserStorage = undefined;
}
if (typeof window !== 'undefined' && !browserStorage) {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, String(value)); },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => { values.clear(); },
    },
  });
}

afterEach(() => {
  cleanup();
});
