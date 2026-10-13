'use client';
import { useText } from '@/i18n/useText';



import * as React from 'react';
import { createPortal } from 'react-dom';
import { IconActionButton } from '@/components/shared/ActionButton';

export type CNVPlotAnchor = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>;

/** A non-modal plot stays open until its own close button is used. */
export function CNVPlotWindow({ open, title, onClose, children, anchor }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; anchor?: CNVPlotAnchor;
}) {
  const t = useText();
  const [position, setPosition] = React.useState({ x: 24, y: 96 });
  const [heightLimit, setHeightLimit] = React.useState<number>();
  const ref = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ id: number; x: number; y: number; left: number; top: number } | undefined>(undefined);
  const clamp = React.useCallback((x: number, y: number) => {
    const bounds = ref.current?.getBoundingClientRect();
    return { x: Math.max(8, Math.min(x, window.innerWidth - (bounds?.width ?? 300) - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - 120)) };
  }, []);
  React.useEffect(() => {
    if (!open) return;
    const place = () => {
      if (!anchor) { setHeightLimit(undefined); setPosition(clamp(24, 96)); return; }
      const top = Math.max(16, Math.min(anchor.top, window.innerHeight - 16));
      const bottom = Math.max(top, Math.min(anchor.bottom, window.innerHeight - 16));
      const above = Math.max(0, top - 28), below = Math.max(0, window.innerHeight - bottom - 28);
      const useBelow = below >= above;
      setHeightLimit(Math.max(80, useBelow ? below : above));
      setPosition(clamp(Math.max(24, anchor.left), useBelow ? bottom + 12 : 16));
    };
    place();
    const resize = () => { if (anchor) place(); else setPosition(value => clamp(value.x, value.y)); };
    window.addEventListener('resize', resize);
    return () => { drag.current = undefined; window.removeEventListener('resize', resize); };
  }, [open, anchor, clamp]);
  const titleId = React.useId();
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div ref={ref} role="dialog" aria-modal="false" aria-labelledby={titleId}
      className="fixed z-[80] flex max-h-[calc(100dvh-32px)] w-[min(900px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-border-default bg-canvas-default shadow-2xl"
      style={{ left: position.x, top: position.y, maxHeight: heightLimit === undefined ? `calc(100dvh - ${position.y + 16}px)` : `min(${heightLimit}px, calc(100dvh - ${position.y + 16}px))` }}>
      <div tabIndex={0} aria-label={t("tasks.dragThePlotTitleOrUseArrowfb3d50")} className="flex shrink-0 touch-none cursor-move select-none items-center justify-between gap-3 border-b border-border-default bg-canvas-subtle px-4 py-3"
        onPointerDown={event => {
          if (event.button !== 0) return;
          setHeightLimit(undefined);
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
          event.preventDefault(); setHeightLimit(undefined); setPosition(value => clamp(value.x + direction[0], value.y + direction[1]));
        }}>
        <h3 id={titleId} className="min-w-0 text-sm font-semibold">{title}</h3>
        <span onPointerDown={event => event.stopPropagation()}>
          <IconActionButton action="close" label={t("tasks.closePlotWindow563fdd")} variant="ghost" onClick={onClose} />
        </span>
      </div>
      <div className="min-h-0 overflow-auto p-4">{children}</div>
    </div>, document.body,
  );
}
