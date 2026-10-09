'use client';

import * as React from 'react';
import { Button } from '@schema/ui-kit';
import { Upload } from 'lucide-react';

export function FilePicker({ label, accept, file, onChange, disabled = false }: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (file: File) => void;
  disabled?: boolean;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const nameID = React.useId();

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-md border border-border-default bg-canvas-default p-3">
      <input
        ref={input}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-label={label}
        className="hidden"
        onChange={event => {
          const selected = event.currentTarget.files?.[0];
          // Allow the same file to be chosen again after a failed upload.
          event.currentTarget.value = '';
          if (selected) onChange(selected);
        }}
      />
      <Button type="button" variant="secondary" size="small" className="yj-tool-button shrink-0" leftIcon={<Upload className="h-4 w-4" />} aria-label={`选择${label}`} aria-describedby={nameID} disabled={disabled} onClick={() => input.current?.click()}>
        {file ? '重新选择' : '选择文件'}
      </Button>
      <div id={nameID} className={`mt-1.5 min-w-0 flex-1 break-all text-xs leading-5 ${file ? 'text-fg-default' : 'text-fg-muted'}`}>
        {file?.name || '未选择文件'}
      </div>
    </div>
  );
}
