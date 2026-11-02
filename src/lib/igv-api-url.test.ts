import { expect, it, vi } from 'vitest';
import { igvReferenceURL } from './igv-api-url';
vi.mock('./api', () => ({ apiResourceURL: (path: string, query: Record<string, string>) => '/current-api' + path + '?' + new URLSearchParams(query) }));

it.each(['/v1/tasks/task/results/igv/reference/fasta?attempt=a', 'https://old.example/api/v1/octopus/tasks/task/results/igv/reference/fasta?attempt=a'])('resolves reference proxy URLs through the current API: %s', value => {
  expect(igvReferenceURL('task', value)).toBe('/current-api/v1/tasks/task/results/igv/reference/fasta?attempt=a');
});
it('preserves external reference providers and rejects proxy fragments', () => {
  const external = 'https://reference.example/hg19.fa?signature=unchanged';
  expect(igvReferenceURL('task', external)).toBe(external);
  expect(() => igvReferenceURL('task', '/v1/tasks/task/results/igv/reference/fai#invalid')).toThrow();
});
