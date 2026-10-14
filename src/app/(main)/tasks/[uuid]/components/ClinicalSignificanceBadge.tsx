import * as React from 'react';

export type BadgeTone = 'neutral' | 'amber' | 'orange' | 'red' | 'teal' | 'green' | 'blue';
const colors: Record<BadgeTone, string> = {
  neutral: 'bg-canvas-inset text-fg-muted border-border-default',
  amber: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200',
  orange: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200',
  red: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200',
  teal: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-200',
  green: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200',
};

/** Shared visual treatment for ClinVar significance and ACMG classifications. */
export function ClinicalSignificanceBadge({value, tone, children, className = '', ...props}: {
  value?: string;
  tone?: BadgeTone;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const normalized = (value ?? '').trim().toLowerCase().replaceAll('_', ' ');
  let resolved: BadgeTone = 'neutral';
  if (/conflict|uncertain|vus/.test(normalized) || (/benign/.test(normalized) && /pathogenic/.test(normalized))) resolved = 'amber';
  else if (/likely pathogenic/.test(normalized)) resolved = 'orange';
  else if (/pathogenic/.test(normalized)) resolved = 'red';
  else if (/likely benign/.test(normalized)) resolved = 'teal';
  else if (/benign/.test(normalized)) resolved = 'green';
  else if (/risk|drug response|association|protective/.test(normalized)) resolved = 'blue';
  return <span {...props} className={`yj-significance-badge inline-flex max-w-full items-center justify-center rounded-md border px-2 py-1 text-center text-xs font-medium break-words ${colors[tone ?? resolved]} ${className}`}>{children ?? value}</span>;
}
