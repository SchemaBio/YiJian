import { describe, expect, it } from 'vitest';
import { isLocale, locales, policyLocale, resolveLocale } from './locales';

describe('locale resolution', () => {
  it.each(locales)('accepts deployment locale %s and preserves a saved preference', locale => {
    expect(resolveLocale(undefined, locale)).toBe(locale);
    expect(resolveLocale('en', locale)).toBe('en');
    expect(isLocale(locale)).toBe(true);
  });
  it('uses Chinese by default and ignores invalid preferences', () => {
    expect(resolveLocale()).toBe('zh-CN');
    expect(resolveLocale('fr', 'es-419')).toBe('es-419');
    expect(resolveLocale('fr', 'de')).toBe('zh-CN');
    expect(isLocale('zh-TW')).toBe(false);
  });
  it('supports legacy policy links without changing global language', () => {
    expect(policyLocale('zh', 'es-419')).toBe('zh-CN');
    expect(policyLocale('en', 'zh-CN')).toBe('en');
    expect(policyLocale('zh-Hant', 'en')).toBe('zh-Hant');
    expect(policyLocale(null, 'es-419')).toBe('es-419');
    expect(policyLocale('fr', 'zh-Hant')).toBe('zh-Hant');
  });
});
