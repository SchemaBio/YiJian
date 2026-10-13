'use client';
import { useText } from '@/i18n/useText';



import * as React from 'react';
import { ActionButton } from '@/components/shared/ActionButton';

/** Tabs and newlines in identifiers must not create extra spreadsheet cells. */
export function tableTSV(rows: Array<Array<string | number>>) {
  return rows.map(row => row.map(cell => String(cell).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
}

export function CopyTableButton({ rows, label: suppliedLabel }: { rows: Array<Array<string | number>>; label?: string }) {
  const t = useText();
  const label = suppliedLabel ?? t("tasks.copyTableef798c");
  const [status, setStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle');
  React.useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <ActionButton action={status === 'copied' ? 'copied' : 'copy'} size="small" type="button" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border-default bg-canvas-default px-3 text-xs text-fg-default hover:bg-canvas-subtle" onClick={async () => {
        try { await navigator.clipboard.writeText(tableTSV(rows)); setStatus('copied'); }
        catch { setStatus('failed'); }
      }}>
        {status === 'copied' ? t("tasks.copiedPasteIntoExcelf14d85") : label}
      </ActionButton>
      <span role="status" className="text-xs text-fg-muted">{status === 'failed' ? t("tasks.copyFailedSelectTableContentToCopy5681e3") : ''}</span>
    </div>
  );
}
