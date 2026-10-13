import type { Locale } from './locales';

const decimals = new Map<Locale, string>();

/** Keep every significant digit and the exponent of an already formatted value. */
export function formatNumericString(value: string, locale: Locale): string {
  if (!/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)) return value;
  let decimal = decimals.get(locale);
  if (!decimal) {
    decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal')?.value ?? '.';
    decimals.set(locale, decimal);
  }
  return value.replace('.', decimal);
}
