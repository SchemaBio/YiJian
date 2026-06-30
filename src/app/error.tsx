'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary component for handling runtime errors.
 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="yj-modern yj-public-shell flex items-center justify-center p-8">
      <div className="yj-panel w-full max-w-md p-10 text-center">
        <div className="yj-public-alert mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-fg-default mb-2">
          出错了
        </h2>
        <p className="text-fg-muted mb-6">
          抱歉，应用程序遇到了一个错误。请尝试刷新页面或稍后再试。
        </p>
        <button
          onClick={reset}
          className="yj-public-primary inline-flex items-center rounded-xl px-4 py-2 transition-colors"
        >
          重试
        </button>
      </div>
    </div>
  );
}
