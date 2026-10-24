import * as React from 'react';

export type HpoTerm = {
  id: string;
  name: string;
  nameEn?: string;
  definition?: string;
  synonyms?: string[];
};

type RawHpoTerm = {
  id?: string;
  name?: string;
  name_cn?: string;
  definition?: string;
  definition_cn?: string;
  synonyms?: string[];
  obsolete?: boolean;
};

const HPO_TERMS_PATH = '/hpo_terms_cn.json';

export const HPO_TERMS_SOURCE_URL =
  'https://github.com/pzweuj/DeepHPO/raw/refs/heads/main/public/hpo_terms_cn.json';

const DEFAULT_HPO_IDS = [
  'HP:0001250',
  'HP:0001249',
  'HP:0001252',
  'HP:0001263',
  'HP:0000252',
  'HP:0001635',
  'HP:0001962',
  'HP:0002094',
  'HP:0000365',
  'HP:0000518',
];

const FALLBACK_HPO_TERMS: HpoTerm[] = [
  { id: 'HP:0001250', name: '癫痫发作', nameEn: 'Seizure' },
  { id: 'HP:0001249', name: '智力障碍', nameEn: 'Intellectual disability' },
  { id: 'HP:0001252', name: '肌张力减退', nameEn: 'Hypotonia' },
  { id: 'HP:0001263', name: '发育迟缓', nameEn: 'Global developmental delay' },
  { id: 'HP:0000252', name: '小头畸形', nameEn: 'Microcephaly' },
  { id: 'HP:0001635', name: '充血性心力衰竭', nameEn: 'Congestive heart failure' },
  { id: 'HP:0001962', name: '心悸', nameEn: 'Palpitations' },
  { id: 'HP:0002094', name: '呼吸困难', nameEn: 'Dyspnea' },
  { id: 'HP:0000365', name: '听力损失', nameEn: 'Hearing impairment' },
  { id: 'HP:0000518', name: '白内障', nameEn: 'Cataract' },
];

const cachedTermsById = new Map<string, HpoTerm>(
  FALLBACK_HPO_TERMS.map((term) => [term.id, term])
);

let cachedTerms: HpoTerm[] | null = null;
let loadingTerms: Promise<HpoTerm[]> | null = null;

function normalizeHpoTerms(raw: unknown): HpoTerm[] {
  if (!raw || typeof raw !== 'object') return FALLBACK_HPO_TERMS;

  const terms = Object.entries(raw as Record<string, RawHpoTerm>)
    .map(([key, value]) => {
      const id = value.id || key;
      const name = value.name_cn || value.name || id;

      return {
        id,
        name,
        nameEn: value.name,
        definition: value.definition_cn || value.definition,
        synonyms: value.synonyms,
      };
    })
    .filter((term) => term.id.startsWith('HP:') && !(raw as Record<string, RawHpoTerm>)[term.id]?.obsolete);

  for (const term of terms) {
    cachedTermsById.set(term.id, term);
  }

  return terms;
}

async function loadHpoTerms(): Promise<HpoTerm[]> {
  if (cachedTerms) return cachedTerms;
  if (loadingTerms) return loadingTerms;

  loadingTerms = fetch(HPO_TERMS_PATH)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load HPO terms: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      cachedTerms = normalizeHpoTerms(data);
      return cachedTerms;
    })
    .catch(() => {
      cachedTerms = FALLBACK_HPO_TERMS;
      return cachedTerms;
    });

  return loadingTerms;
}

export function useHpoTerms(enabled = true) {
  const [terms, setTerms] = React.useState<HpoTerm[]>(cachedTerms ?? FALLBACK_HPO_TERMS);

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    loadHpoTerms().then((loadedTerms) => {
      if (!cancelled) setTerms(loadedTerms);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return terms;
}

function defaultHpoTerms(terms: HpoTerm[]) {
  const byId = new Map(terms.map((term) => [term.id, term]));
  const defaults = DEFAULT_HPO_IDS.map((id) => byId.get(id)).filter((term): term is HpoTerm => Boolean(term));

  return defaults.length ? defaults : FALLBACK_HPO_TERMS;
}

export function searchHpoTerms(terms: HpoTerm[], query: string, limit = 20): HpoTerm[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return defaultHpoTerms(terms).slice(0, 5);

  const matches = terms
    .map((term) => {
      const id = term.id.toLowerCase();
      const name = term.name.toLowerCase();
      const nameEn = term.nameEn?.toLowerCase() ?? '';

      if (id === normalizedQuery) return { term, score: 0 };
      if (id.startsWith(normalizedQuery)) return { term, score: 1 };
      if (name === normalizedQuery) return { term, score: 2 };
      if (nameEn === normalizedQuery) return { term, score: 2.1 };
      if (name.includes(normalizedQuery)) return { term, score: 3 };
      if (nameEn.includes(normalizedQuery)) return { term, score: 3.1 };
      return null;
    })
    .filter((match): match is { term: HpoTerm; score: number } => Boolean(match))
    .sort((a, b) => a.score - b.score || a.term.id.localeCompare(b.term.id));

  return matches.slice(0, limit).map((match) => match.term);
}

/**
 * 判断当前语言是否应该显示为英语 HPO 术语。
 * 设定规则：只要不是繁体中文和简体中文的语言下，HPO 均显示为英语。
 */
export function isHpoEnglishLocale(locale?: string): boolean {
  if (!locale) return false;
  return locale !== 'zh-CN' && locale !== 'zh-Hant' && !locale.startsWith('zh');
}

export function getCachedHpoTerm(id: string): HpoTerm | undefined {
  return cachedTermsById.get(id);
}

/**
 * 根据语言获取 HPO 术语的展示名称。
 * 只要不是繁体中文和简体中文的语言下，优先显示英语名称；
 * 繁体中文和简体中文下显示中文名称。
 */
export function getHpoTermName(
  term: { id: string; name?: string; nameEn?: string },
  locale?: string,
  catalog?: HpoTerm[]
): string {
  const isEnglish = isHpoEnglishLocale(locale);
  const found = (catalog ? catalog.find((item) => item.id === term.id) : null) ?? cachedTermsById.get(term.id);

  if (isEnglish) {
    return term.nameEn || found?.nameEn || term.name || term.id;
  }
  return found?.name || term.name || found?.nameEn || term.nameEn || term.id;
}
