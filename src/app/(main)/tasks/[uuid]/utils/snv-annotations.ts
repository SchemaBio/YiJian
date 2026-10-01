import type { SNVIndel } from '../types';

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

// Population AF is a fraction; sample VAF is a separate sequencing metric.
export function formatPopulationFrequency(value?: string | number): string {
  if (value === null || value === undefined || value === '' || value === '.') return '未提供';
  return String(value).split('&').map(part => {
    const number = optionalAnnotationNumber(part.trim());
    return number !== undefined && number >= 0 && number <= 1 ? String(number) : '未提供';
  }).join(' & ');
}
