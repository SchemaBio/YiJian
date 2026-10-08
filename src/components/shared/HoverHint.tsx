'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

/** Match the coordinate hint while mounting a surface only for the active target. */
export function HoverHint({ content, children }: { content: React.ReactNode; children: React.ReactElement<any> }) {
  const id = React.useId();
  const target = React.useRef<HTMLElement | null>(null);
  const surface = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focused = React.useRef(false);
  const hovered = React.useRef(false);
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number; below: boolean } | null>(null);
  const clearTimer = () => { clearTimeout(timer.current); timer.current = undefined; };
  React.useEffect(() => () => clearTimeout(timer.current), []);

  React.useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!target.current?.isConnected || !surface.current) { setOpen(false); return; }
      const rect = target.current.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) { setOpen(false); return; }
      const width = surface.current.offsetWidth;
      const height = surface.current.offsetHeight;
      const below = rect.top < height + 16;
      setPosition({ top: below ? rect.bottom + 8 : rect.top - height - 8, left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2)), below });
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    update();
    // Mouse hints close on scroll; a focused target follows automatic focus scrolling.
    let frame = 0;
    const close = () => {
      if (!focused.current) { setOpen(false); return; }
      cancelAnimationFrame(frame); frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', escape);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  if (content === undefined || content === null || content === '') return children;
  const props = children.props;
  const trigger = React.cloneElement(children, {
    'data-hover-hint': '',
    'aria-describedby': open ? [props['aria-describedby'], id].filter(Boolean).join(' ') : props['aria-describedby'],
    'aria-label': props['aria-label'] ?? (children.type === 'button' && typeof content === 'string' ? content : undefined),
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      props.onMouseEnter?.(event); target.current = event.currentTarget; hovered.current = true; clearTimer();
      timer.current = setTimeout(() => { if (!open) { setPosition(null); setOpen(true); } }, 200);
    },
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
      props.onMouseLeave?.(event); hovered.current = false; clearTimer(); if (!focused.current) setOpen(false);
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      props.onFocus?.(event); target.current = event.currentTarget; focused.current = true; clearTimer(); if (!open) { setPosition(null); setOpen(true); }
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      props.onBlur?.(event); focused.current = false; if (!hovered.current) setOpen(false);
    },
  });
  return <>{trigger}{open && createPortal(
    <div ref={surface} id={id} role="tooltip" className="yj-hover-hint" style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}>
      {content}
      <svg aria-hidden="true" width="12" height="6" className={`yj-hover-hint-arrow ${position?.below ? 'yj-hover-hint-arrow-top' : ''}`}><path d="M0 0 L6 6 L12 0" /></svg>
    </div>, document.body,
  )}</>;
}
