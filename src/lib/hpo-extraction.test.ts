import { describe, expect, it } from 'vitest';
import { extractLocalHpo } from './hpo-extraction';
import { readFileSync } from 'node:fs';
const terms = [
  { id: 'HP:0001250', name: '癫痫发作', nameEn: 'Seizure', synonyms: ['癫痫'] },
  { id: 'HP:0002315', name: '头痛', nameEn: 'Headache' },
  { id: 'HP:0000252', name: '小头畸形', nameEn: 'Microcephaly' },
  { id: 'HP:0005484', name: '严重小头畸形', nameEn: 'Severe microcephaly' },
];
describe('local HPO dictionary segmentation', () => {
  it('extracts Chinese phrases, English terms and explicit IDs without broad substring suggestions', () => {
    expect(extractLocalHpo('癫痫发作，HEADACHE，HP:0000252', terms).map(m => m.term.id)).toEqual(['HP:0001250', 'HP:0002315', 'HP:0000252']);
    expect(extractLocalHpo('headachesuffix and unknown symptom', terms)).toEqual([]);
  });
  it('prefers the longest phrase and deduplicates repeated mentions', () => {
    expect(extractLocalHpo('严重小头畸形，严重小头畸形', terms).map(m => m.term.id)).toEqual(['HP:0005484']);
  });
  it('keeps negation, uncertainty and family history out of positive candidates', () => {
    const matches = extractLocalHpo('无头痛、癫痫。父亲小头畸形。疑似严重小头畸形。', terms);
    expect(matches.map(m => m.polarity)).toEqual(['absent', 'absent', 'family_history', 'uncertain']);
    expect(extractLocalHpo('no headache. Possible seizure', terms).map(m => m.polarity)).toEqual(['absent', 'uncertain']);
  });
  it('keeps an explicit positive occurrence after a negative one and anchors original text', () => {
    const text = '否认头痛，但出现头痛';
    const [match] = extractLocalHpo(text, terms);
    expect(match.polarity).toBe('present');
    expect(text.slice(match.start, match.end)).toBe('头痛');
  });
  it('matches the real bundled DeepHPO vocabulary in a phenotype narrative', () => {
    const raw = JSON.parse(readFileSync('public/hpo_terms_cn.json', 'utf8')) as Record<string, { id: string; name: string; name_cn: string }>;
    const vocabulary = Object.values(raw).map(term => ({ id: term.id, name: term.name_cn, nameEn: term.name }));
    const matches = extractLocalHpo('全面性发育迟缓、肌张力减退，无头痛。父亲癫痫发作。', vocabulary);
    expect(matches.filter(match => match.polarity === 'present' && !match.ambiguous).map(match => match.term.id)).toEqual(['HP:0001263']);
    expect(matches.filter(match => match.ambiguous).map(match => match.term.id).sort()).toEqual(['HP:0001252', 'HP:0010547']);
  });
});
