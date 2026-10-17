'use client';
import { BUSINESS_PERMISSIONS } from '@/lib/permissions';
import { useText } from '@/i18n/useText';
import { ActionButton } from './ActionButton';

export function PermissionEditor({ administrator, values, onChange, disabled }: {
  administrator: boolean; values: string[]; onChange: (values: string[]) => void; disabled?: boolean;
}) {
  const t = useText();
  if (administrator) return <p className="rounded-md bg-canvas-subtle p-3 text-sm">{t('permissions.all')}</p>;
  return <fieldset disabled={disabled} className="space-y-3 rounded-md border border-border-default p-3">
    <legend className="px-1 text-sm font-medium">{t('permissions.title')}</legend>
    <p className="text-xs text-fg-muted">{t('permissions.description')}</p>
    <div className="flex gap-2">
      <ActionButton size="small" onClick={() => onChange([...BUSINESS_PERMISSIONS])}>{t('permissions.selectAll')}</ActionButton>
      <ActionButton size="small" onClick={() => onChange([])}>{t('permissions.clear')}</ActionButton>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">{BUSINESS_PERMISSIONS.map(permission => <label key={permission} className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={values.includes(permission)} onChange={e => onChange(e.target.checked ? [...values, permission] : values.filter(value => value !== permission))} />
      <span>{t(`permissions.labels.${permission.replace('.', '_')}`)}</span>
    </label>)}</div>
  </fieldset>;
}
