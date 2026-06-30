/**
 * Loading component displayed during route transitions.
 */
export default function Loading() {
  return (
    <div className="yj-modern yj-public-shell flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="yj-public-spinner mb-4" />
        <p className="text-fg-muted text-sm">加载中...</p>
      </div>
    </div>
  );
}
