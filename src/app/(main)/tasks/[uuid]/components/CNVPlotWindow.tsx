'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { IconActionButton } from '@/components/shared/ActionButton';

/** A non-modal plot stays open until its own close button is used. */
export function CNVPlotWindow({ open, title, onClose, children }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  const [position, setPosition] = React.useState({ x: 24, y: 96 });
  const ref = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ id: number; x: number; y: number; left: number; top: number } | undefined>(undefined);
  const clamp = React.useCallback((x: number, y: number) => {
    const bounds = ref.current?.getBoundingClientRect();
    return { x: Math.max(8, Math.min(x, window.innerWidth - (bounds?.width ?? 300) - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - 120)) };
  }, []);
  React.useEffect(() => {
    if (!open) return;
    setPosition(clamp(24, 96));
    const resize = () => setPosition(value => clamp(value.x, value.y));
    window.addEventListener('resize', resize);
    return () => { drag.current = undefined; window.removeEventListener('resize', resize); };
  }, [open, clamp]);
  const titleId = React.useId();
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div ref={ref} role="dialog" aria-modal="false" aria-labelledby={titleId}
      className="fixed z-[80] flex max-h-[calc(100dvh-32px)] w-[min(900px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-border-default bg-canvas-default shadow-2xl"
      style={{ left: position.x, top: position.y, maxHeight: `calc(100dvh - ${position.y + 16}px)` }}>
      <div tabIndex={0} aria-label="拖动图窗标题，或使用方向键移动" className="flex shrink-0 touch-none cursor-move select-none items-center justify-between gap-3 border-b border-border-default bg-canvas-subtle px-4 py-3"
        onPointerDown={event => {
          if (event.button !== 0) return;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: position.x, top: position.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          const start = drag.current;
          if (start?.id === event.pointerId) setPosition(clamp(start.left + event.clientX - start.x, start.top + event.clientY - start.y));
        }}
        onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}
        onKeyDown={event => {
          const directions: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
          const direction = directions[event.key];
          if (!direction || event.target !== event.currentTarget) return;
          event.preventDefault(); setPosition(value => clamp(value.x + direction[0], value.y + direction[1]));
        }}>
        <h3 id={titleId} className="min-w-0 text-sm font-semibold">{title}</h3>
        <span onPointerDown={event => event.stopPropagation()}>
          <IconActionButton action="close" label="关闭图窗" variant="ghost" onClick={onClose} />
        </span>
      </div>
      <div className="min-h-0 overflow-auto p-4">{children}</div>
    </div>, document.body,
  );
}
