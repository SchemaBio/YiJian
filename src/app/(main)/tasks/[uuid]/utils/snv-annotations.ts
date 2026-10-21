import type { SNVIndel } from '../types';
import { chineseText, type TextTranslator } from '@/i18n/text';

/** Derive review stars from status; missing or unrecognized status stays missing. */
export function clinvarReviewStars(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const status = value.trim().toLowerCase().replace(/\s+/g, '_');
  // Explicit priority keeps combined statuses deterministic.
  const ratings = [
    ['guideline', '4'],
    ['reviewed_by_expert_panel', '3'],
    ['_multiple_submitters', '2'],
    ['_single_submitter', '1'],
    ['conflicting', '1'],
  ] as const;
  return ratings.find(([key]) => status.includes(key))?.[1];
}

export function optionalAnnotationNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '' || value === '.') return undefined;
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function sourceAnnotation(variant: SNVIndel, column: string, fallback?: string | number): string | undefined {
  const value = variant.annotationValues?.[column] ?? fallback;
  if (value === null || value === undefined || value === '' || value === '.') return undefined;
  return String(value);
}

/** Report Location is from the selected VEP transcript, e.g. Exon 2/20. */
export function transcriptLocation(variant: SNVIndel) {
  const location = sourceAnnotation(variant, 'Location') ?? '';
  const parse = (kind: 'Exon' | 'Intron', column: string) => {
    const value = location.match(new RegExp(`\\b${kind}\\s*(\\d+(?:-\\d+)?)(?:\\s*/\\s*(\\d+))?`, 'i'));
    const raw = sourceAnnotation(variant, column);
    const match = value ?? raw?.trim().match(/^(\d+(?:-\d+)?)(?:\s*\/\s*(\d+))?$/);
    return { number: match?.[1], total: match?.[2] };
  };
  const exon = parse('Exon', 'EXON'), intron = parse('Intron', 'INTRON');
  return {
    label: exon.number ? `Exon${exon.number}` : intron.number ? `Intron${intron.number}` : '—',
    location: location || undefined,
    exonNumber: exon.number,
    intronNumber: intron.number,
    exonTotal: exon.total ?? (intron.total ? String(Number(intron.total) + 1) : undefined),
    intronTotal: intron.total ?? (exon.total && Number(exon.total) > 0 ? String(Number(exon.total) - 1) : undefined),
    exonTotalDerived: !exon.total && Boolean(intron.total),
    intronTotalDerived: !intron.total && Boolean(exon.total),
  };
}

// Population AF is a fraction; sample VAF is a separate sequencing metric.
export function formatPopulationFrequency(value?: string | number, t: TextTranslator = chineseText): string {
  if (value === null || value === undefined || value === '' || value === '.') return t('history.notProvided071fb2');
  return String(value).split('&').map(part => {
    const number = optionalAnnotationNumber(part.trim());
    return number !== undefined && number >= 0 && number <= 1 ? String(number) : t('history.notProvided071fb2');
  }).join(' & ');
}
