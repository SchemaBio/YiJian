import { describe, expect, it, vi } from 'vitest';
import { getMessages } from './messages';
import { locales } from './locales';
import { createTextTranslator, localizeDisplay } from './text';
import { errorText, LocalizedError } from './errors';
import sources from './sources.json';

function flatten(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.assign({}, ...Object.entries(value).map(([key, item]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    return typeof item === 'string' ? {[full]: item} : flatten(item as Record<string, unknown>, full);
  }));
}
describe('language catalogs', () => {
  it('has identical keys and interpolation parameters in all four catalogs', () => {
    const base = flatten(getMessages('zh-CN'));
    for (const locale of locales) {
      const current = flatten(getMessages(locale));
      expect(Object.keys(current).sort()).toEqual(Object.keys(base).sort());
      for (const key of Object.keys(base)) {
        const parameters = (text: string) => [...new Set(text.match(/\{p\d+(?=[},])/g) ?? [])].sort();
        expect(parameters(current[key])).toEqual(parameters(base[key]));
        expect(current[key].match(/p\d+, plural/g)?.sort() ?? []).toEqual(base[key].match(/p\d+, plural/g)?.sort() ?? []);
      }
    }
  });
  it.each(locales)('formats every message in %s without ICU errors', locale => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const t = createTextTranslator(locale);
      const current = flatten(getMessages(locale));
      for (const [key, value] of Object.entries(current)) {
        const values = Object.fromEntries((value.match(/\{p\d+(?=[},])/g) ?? []).map(p => [p.slice(1), 10]));
        expect(t(key, values)).toBeTruthy();
      }
      expect(errors).not.toHaveBeenCalled();
    } finally { errors.mockRestore(); }
  });
  it('has a dictionary entry for every registered UI label and no Chinese placeholders in western translations', () => {
    for (const locale of locales) {
      const catalog = flatten(getMessages(locale));
      for (const key of Object.values(sources)) expect(catalog[key], `${locale}: ${key}`).toBeDefined();
      if (locale === 'en' || locale === 'es-419') {
        for (const [key,value] of Object.entries(catalog)) {
          // Legal company name and CSV business examples are deliberately preserved.
          if (key === 'privacy.operator' || value.includes('\n')) continue;
          expect(value, `${locale}: ${key}`).not.toMatch(/[\u4e00-\u9fff]/);
        }
      }
    }
  });
  it('translates only explicitly identified frontend errors', () => {
    const t = createTextTranslator('en');
    expect(errorText(new LocalizedError('请求失败'), t)).toBe('Request failed');
    expect(errorText(new Error('请求失败'), t)).toBe('请求失败');
    expect(errorText(new Error('upstream custom message'), t)).toBe('upstream custom message');
  });
  it('logs missing keys and falls back to Chinese with interpolation intact', () => {
    const catalog = getMessages('en').samples as Record<string, string>;
    const original = catalog.turnaroundDays;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      delete (catalog as Partial<typeof catalog>).turnaroundDays;
      expect(createTextTranslator('en')('samples.turnaroundDays', {p0: 2}))
        .toBe(createTextTranslator('zh-CN')('samples.turnaroundDays', {p0: 2}));
      expect(errors).toHaveBeenCalledWith('[i18n] Missing message', {locale: 'en', key: 'samples.turnaroundDays'});
    } finally { catalog.turnaroundDays = original; errors.mockRestore(); }
  });
  it('formats singular and plural counts with the active language', () => {
    expect(createTextTranslator('en')('samples.turnaroundDays',{p0:1})).toBe('1 day');
    expect(createTextTranslator('en')('samples.turnaroundDays',{p0:2})).toBe('2 days');
    expect(createTextTranslator('es-419')('samples.turnaroundDays',{p0:1})).toBe('1 día');
  });
  it('keeps values, user content and accessor functions intact', () => {
    const accessor = () => 'patient original text';
    const input = [{label: '界面语言', value: '全血', name: '患者资料', accessor}];
    const output = localizeDisplay(input, createTextTranslator('en'));
    expect(output[0].label).toBe('Interface language');
    expect(output[0].value).toBe('全血');
    expect(output[0].name).toBe('患者资料');
    expect(output[0].accessor).toBe(accessor);
    expect(input[0].label).toBe('界面语言');
  });
});
