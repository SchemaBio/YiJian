import * as React from 'react';

export function ClinVarBadge({value}: {value?: string}) {
  const text = value?.trim();
  const normalized = (text ?? '').toLowerCase().replaceAll('_',' ');
  let color = 'bg-canvas-inset text-fg-muted border-border-default';
  if (/conflict|uncertain|vus/.test(normalized) || (/benign/.test(normalized) && /pathogenic/.test(normalized))) color='bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200';
  else if (/likely pathogenic/.test(normalized)) color='bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200';
  else if (/pathogenic/.test(normalized)) color='bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200';
  else if (/likely benign/.test(normalized)) color='bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-200';
  else if (/benign/.test(normalized)) color='bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200';
  else if (/risk|drug response|association|protective/.test(normalized)) color='bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200';
  return <span title={text} className={`yj-clinvar-badge inline-flex max-w-full items-center justify-center rounded-md border px-2 py-1 text-center text-xs font-medium break-words ${color}`}>{text && !['.','-'].includes(text) ? text : '未提供'}</span>;
}
