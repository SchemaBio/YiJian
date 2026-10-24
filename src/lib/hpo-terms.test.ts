import { describe, expect, it } from 'vitest';
import {
  getCachedHpoTerm,
  getHpoTermName,
  isHpoEnglishLocale,
  searchHpoTerms,
  type HpoTerm,
} from './hpo-terms';

describe('hpo-terms localization', () => {
  describe('isHpoEnglishLocale', () => {
    it('returns false for Simplified Chinese (zh-CN) and Traditional Chinese (zh-Hant)', () => {
      expect(isHpoEnglishLocale('zh-CN')).toBe(false);
      expect(isHpoEnglishLocale('zh-Hant')).toBe(false);
      expect(isHpoEnglishLocale('zh-TW')).toBe(false);
      expect(isHpoEnglishLocale('zh')).toBe(false);
    });

    it('returns true for any non-Chinese locale (en, es-419, etc.)', () => {
      expect(isHpoEnglishLocale('en')).toBe(true);
      expect(isHpoEnglishLocale('es-419')).toBe(true);
      expect(isHpoEnglishLocale('fr')).toBe(true);
      expect(isHpoEnglishLocale('ja')).toBe(true);
      expect(isHpoEnglishLocale('de')).toBe(true);
    });

    it('defaults to false when locale is undefined', () => {
      expect(isHpoEnglishLocale(undefined)).toBe(false);
    });
  });

  describe('getHpoTermName', () => {
    const customCatalog: HpoTerm[] = [
      { id: 'HP:0001250', name: '癫痫发作', nameEn: 'Seizure' },
      { id: 'HP:0000252', name: '小头畸形', nameEn: 'Microcephaly' },
      { id: 'HP:9999999', name: '仅中文术语' },
    ];

    it('returns English name when locale is not Simplified or Traditional Chinese', () => {
      // In English locale
      expect(getHpoTermName({ id: 'HP:0001250', name: '癫痫发作' }, 'en', customCatalog)).toBe('Seizure');
      // In Spanish locale
      expect(getHpoTermName({ id: 'HP:0001250', name: '癫痫发作' }, 'es-419', customCatalog)).toBe('Seizure');
      // Directly provides nameEn
      expect(getHpoTermName({ id: 'HP:0001250', name: '癫痫发作', nameEn: 'Seizure' }, 'en')).toBe('Seizure');
    });

    it('returns Chinese name for Simplified Chinese and Traditional Chinese', () => {
      expect(getHpoTermName({ id: 'HP:0001250', name: '癫痫发作' }, 'zh-CN', customCatalog)).toBe('癫痫发作');
      expect(getHpoTermName({ id: 'HP:0001250', name: '癫痫发作' }, 'zh-Hant', customCatalog)).toBe('癫痫发作');
    });

    it('allows dynamic language switching even if the term was stored in the other language', () => {
      // Stored with Chinese name, viewed in English
      const savedInChinese = { id: 'HP:0000252', name: '小头畸形' };
      expect(getHpoTermName(savedInChinese, 'en', customCatalog)).toBe('Microcephaly');

      // Stored with English name, viewed in Chinese
      const savedInEnglish = { id: 'HP:0000252', name: 'Microcephaly' };
      expect(getHpoTermName(savedInEnglish, 'zh-CN', customCatalog)).toBe('小头畸形');
      expect(getHpoTermName(savedInEnglish, 'zh-Hant', customCatalog)).toBe('小头畸形');
    });

    it('uses fallback catalog when catalog is not passed explicitly', () => {
      // HP:0001250 is in FALLBACK_HPO_TERMS
      expect(getHpoTermName({ id: 'HP:0001250', name: '癫痫发作' }, 'en')).toBe('Seizure');
      expect(getHpoTermName({ id: 'HP:0001250', name: 'Seizure' }, 'zh-CN')).toBe('癫痫发作');
    });

    it('falls back to term name if English translation is not available', () => {
      expect(getHpoTermName({ id: 'HP:9999999', name: '仅中文术语' }, 'en', customCatalog)).toBe('仅中文术语');
    });
  });

  describe('searchHpoTerms', () => {
    it('matches by English or Chinese query', () => {
      const catalog: HpoTerm[] = [
        { id: 'HP:0001250', name: '癫痫发作', nameEn: 'Seizure' },
        { id: 'HP:0001249', name: '智力障碍', nameEn: 'Intellectual disability' },
      ];
      expect(searchHpoTerms(catalog, 'seizure')).toEqual([catalog[0]]);
      expect(searchHpoTerms(catalog, '癫痫')).toEqual([catalog[0]]);
      expect(searchHpoTerms(catalog, 'HP:0001250')).toEqual([catalog[0]]);
    });
  });
});
