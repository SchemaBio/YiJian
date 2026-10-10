'use client';

import * as React from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/** Docked on wide workspaces, modal drawer on smaller screens. */
export function WorkspaceInspector({ children, label, onClose }: {
  children: React.ReactNode;
  label: string;
  onClose: () => void;
}) {
  const docked = useMediaQuery('(min-width: 1440px)');
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (docked) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [docked]);

  return <>
    {!docked && <div className="yj-inspector-backdrop" aria-hidden="true" onClick={onClose} />}
    <div ref={ref} role={docked ? 'region' : 'dialog'} aria-modal={docked ? undefined : true}
      aria-label={label} tabIndex={-1} className="yj-inspector"
      onKeyDown={event => {
        if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab' || docked) return;
        const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])
          .filter(element => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
      }}>
      {children}
    </div>
  </>;
}

export type InspectorSection = 'annotation' | 'evidence' | 'assessment' | 'history' | 'acmg' | 'svcv4' | 'interpretation';
const LABELS: Record<InspectorSection, string> = { annotation: '注释', evidence: '证据', assessment: '评定', history: '变更记录',acmg:'ACMG评定（现版）',svcv4:'ACMG评定（SVC v4.0试行）',interpretation:'人工解读' };
const DEFAULT_SECTIONS: InspectorSection[] = ['annotation', 'evidence', 'assessment'];

export function InspectorTabs({ value, onChange, id, sections = DEFAULT_SECTIONS }: {
  value: InspectorSection; onChange: (value: InspectorSection) => void; id: string; sections?: InspectorSection[];
}) {
  return <div className="yj-inspector-tabs" role="tablist" aria-label="详情内容">
    {sections.map((section, index) => <button key={section} type="button" role="tab"
      id={`${id}-${section}`} aria-controls={`${id}-content`} aria-selected={value === section}
      tabIndex={value === section ? 0 : -1} onClick={() => onChange(section)}
      onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % sections.length : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault(); onChange(sections[next]);
        (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
      }}>{LABELS[section]}</button>)}
  </div>;
}
