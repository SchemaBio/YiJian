import { expect, it } from 'vitest';
import { formatNumericString } from './format';
import { locales } from './locales';

it('preserves every scientific significant digit and exponent in all languages', () => {
  const value = '0.123456789012345678901e-17';
  for (const locale of locales) {
    const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal')!.value;
    expect(formatNumericString(value, locale)).toBe(value.replace('.', decimal));
    expect(formatNumericString('BRCA1 c.123A>G', locale)).toBe('BRCA1 c.123A>G');
    expect(formatNumericString('1,234', locale)).toBe('1,234');
  }
});
