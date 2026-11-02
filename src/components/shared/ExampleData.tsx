'use client';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { useText } from '@/i18n/useText';

export function ExampleBadge({ origin }: { origin?: string }) {
  const t = useText();
  if (getRuntimeBackendFlavor() !== 'squid' || origin !== 'example') return null;
  return <span className="ml-2 inline-flex rounded border border-border-default px-1.5 py-0.5 text-xs text-fg-muted">{t('exampleData.label')}</span>;
}

export function ExampleDataNotice() {
  return null;
}
