import * as React from 'react';

import { badgeColors, badgeShape, type BadgeTone } from '@/components/shared/badge-styles';
export type { BadgeTone } from '@/components/shared/badge-styles';

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
  return <span {...props} className={`yj-significance-badge ${badgeShape} break-words ${badgeColors[tone ?? resolved]} ${className}`}>{children ?? value}</span>;
}
