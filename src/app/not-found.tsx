import Link from 'next/link';

/**
 * 404 Not Found page.
 */
export default function NotFound() {
  return (
    <div className="yj-modern yj-public-shell flex items-center justify-center p-8">
      <div className="yj-panel w-full max-w-md p-10 text-center">
        <h1 className="mb-4 text-6xl font-bold text-fg-muted">404</h1>
        <h2 className="text-xl font-semibold text-fg-default mb-2">
          页面未找到
        </h2>
        <p className="text-fg-muted mb-6">
          抱歉，您访问的页面不存在或已被移除。
        </p>
        <Link
          href="/samples"
          className="yj-public-primary inline-flex items-center rounded-xl px-4 py-2 transition-colors"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
