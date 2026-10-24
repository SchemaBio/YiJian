import type { HpoTerm } from './hpo-terms';

export type LocalHpoMatch = { term: HpoTerm; text: string; start: number; end: number; ambiguous?: boolean; polarity: 'present' | 'absent' | 'uncertain' | 'family_history' };
type Node = { next: Map<string, Node>; terms?: HpoTerm[] };
const indexes = new WeakMap<HpoTerm[], Node>();
const word = (value: string) => /[a-z0-9]/i.test(value);

function indexTerms(terms: HpoTerm[]): Node {
  const cached = indexes.get(terms);
  if (cached) return cached;
  const root: Node = { next: new Map() };
  for (const term of terms) {
    if (term.id === 'HP:0000001') continue;
    for (const name of new Set([term.name, term.nameEn, term.id, ...(term.synonyms ?? [])])) {
      if (!name || name.length < 2) continue;
      let node = root;
      for (const char of name.toLowerCase()) {
        if (!node.next.has(char)) node.next.set(char, { next: new Map() });
        node = node.next.get(char)!;
      }
      node.terms = [...(node.terms ?? []), term];
    }
  }
  indexes.set(terms, root);
  return root;
}

function polarity(text: string, start: number, end: number): LocalHpoMatch['polarity'] {
  const sentence = text.slice(0, start).split(/[。！？!?;；.\n]/).at(-1) ?? '';
  // Family-history scope lasts until an explicit return to the subject.
  const subject = sentence.split(/但|但是|然而|but\b|however\b|患者|本人|受试者/iu).at(-1) ?? '';
  if (/(家族史|家族中|父亲|母亲|父母|兄弟|姐妹|父親|母親|family history|father|mother|sibling)/iu.test(subject)) return 'family_history';
  const clause = subject.split(/[，,:：]/).at(-1) ?? '';
  if (/(未见|未发现|否认|没有|不伴|无|未見|否認|沒有|無|without\b|no\b|not\b|denies\b)/iu.test(clause)) return 'absent';
  const suffix = text.slice(end).split(/[，,、。;；!?！？\n]/)[0];
  if (/(疑似|可能|待排|怀疑|懷疑|possible|suspected|rule out)/iu.test(clause) || /^(?:\s*)(?:阴性|陰性|未见|未見|absent\b|negative\b)/iu.test(suffix)) return 'uncertain';
  return 'present';
}

/** Browser-only dictionary segmentation inspired by DeepHPO; no model or network calls. */
export function extractLocalHpo(text: string, terms: HpoTerm[], limit = 100): LocalHpoMatch[] {
  const root = indexTerms(terms), normalized = text.toLowerCase();
  const result = new Map<string, LocalHpoMatch>();
  for (let start = 0; start < normalized.length && result.size < limit; start++) {
    let node = root;
    let longest: { end: number; terms: HpoTerm[] } | undefined;
    for (let end = start; end < normalized.length; end++) {
      const next = node.next.get(normalized[end]);
      if (!next) break;
      node = next;
      if (node.terms && !(word(normalized[start]) && start > 0 && word(normalized[start - 1])) && !(word(normalized[end]) && end + 1 < normalized.length && word(normalized[end + 1]))) longest = { end: end + 1, terms: node.terms };
    }
    if (!longest) continue;
    for (const term of longest.terms) {
      const match = { term, text: text.slice(start, longest.end), start, end: longest.end, ambiguous: new Set(longest.terms.map(term => term.id)).size > 1, polarity: polarity(text, start, longest.end) };
      const previous = result.get(term.id);
      if (!previous || (previous.polarity !== 'present' && match.polarity === 'present') || (previous.polarity === match.polarity && previous.ambiguous && !match.ambiguous)) result.set(term.id, match);
    }
    start = longest.end - 1;
  }
  return [...result.values()].slice(0, limit);
}
