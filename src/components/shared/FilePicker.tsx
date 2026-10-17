'use client';
import { useBusinessPermissions, useOperationPermission } from '@/components/providers/BusinessPermissionProvider';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';



export function FilePicker({ label, accept, file, onChange, disabled = false }: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (file: File) => void;
  disabled?: boolean;
}) {
  const t = useText();
  const { hasPermission } = useBusinessPermissions();
  const permission = useOperationPermission();
  disabled = disabled || (!!permission && !hasPermission(permission));
  const input = React.useRef<HTMLInputElement>(null);
  const nameID = React.useId();

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-md border border-border-default bg-canvas-default p-3">
      <input
        ref={input}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-label={translateUI(label, t)}
        className="hidden"
        onChange={event => {
          const selected = event.currentTarget.files?.[0];
          // Allow the same file to be chosen again after a failed upload.
          event.currentTarget.value = '';
          if (selected) onChange(selected);
        }}
      />
      <Button action="upload" type="button" variant="secondary" size="small" className="yj-tool-button shrink-0"  aria-label={t("pipeline.select9dd365", {p0: String(label)})} aria-describedby={nameID} disabled={disabled} onClick={() => input.current?.click()}>
        {file ? t("common.chooseAgain23381f") : t("common.chooseFile21a6f5")}
      </Button>
      <div id={nameID} className={`mt-1.5 min-w-0 flex-1 break-all text-xs leading-5 ${file ? 'text-fg-default' : 'text-fg-muted'}`}>
        {file?.name || t("common.noFileChosendbb443")}
      </div>
    </div>
  );
}
