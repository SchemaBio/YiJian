// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { demoSelection, loadDemoFile, loadDemoManifest, staticDemoURL, validateManifest, type DemoManifest } from './source';
import { DEMO_BASE, DEMO_MANIFEST, demoContentSecurityPolicy, isDemoPath } from './policy';

const manifest = JSON.parse(readFileSync('public' + DEMO_MANIFEST, 'utf8')) as DemoManifest;
const signal = () => new AbortController().signal;
afterEach(() => vi.unstubAllGlobals());

describe('public static demo contract', () => {
  it('accepts the shipped snapshot and refuses URLs, traversal and other versions', () => {
    expect(validateManifest(manifest).requiredVariant).toEqual({ reference: 'hg38', chromosome: '17', position: 10641317, ref: 'C', alt: 'T', gene: 'MYH3' });
    for (const path of ['../result.parquet', '/api/result.parquet', 'https://production/x.parquet', '//production/x.parquet', 'x%2f.parquet', 'x.parquet?token=secret', 'x.parquet#hash', 'x\\a.parquet']) expect(() => staticDemoURL(path)).toThrow();
    expect(() => validateManifest({ ...manifest, version: 'other' })).toThrow();
    expect(() => validateManifest({ ...manifest, files: [{ ...manifest.files[0], file: '../private.parquet' }] })).toThrow();
  });
  it('loads the manifest and only a listed checksum-verified file without credentials', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const fetcher = vi.fn(async (path: string) => new Response(path.endsWith('.json') ? JSON.stringify(manifest) : readFileSync('public' + path)));
    vi.stubGlobal('fetch', fetcher);
    const m = await loadDemoManifest(signal());
    const bytes = await loadDemoFile(m, 'snv-indel', signal());
    expect(bytes.byteLength).toBe(m.files[0].bytes);
    expect(fetcher.mock.calls.map(c => c[0])).toEqual([DEMO_MANIFEST, DEMO_BASE + m.files[0].file]);
    for (const call of vi.mocked(fetch).mock.calls) expect(call[1]).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'error' });
    const count = fetcher.mock.calls.length;
    await expect(loadDemoFile(m, 'production-task', signal())).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(count);
  });
  it('fails closed on missing or corrupted resources without trying a business API', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const fetcher = vi.fn().mockResolvedValue(new Response('missing', { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadDemoManifest(signal())).rejects.toThrow('404');
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(new Response('corrupted'));
    await expect(loadDemoFile(manifest, 'snv-indel', signal())).rejects.toThrow('checksum');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('escapes text filters, validates sort fields and sorts numeric positions numerically', () => {
    const q = { page: 1, pageSize: 25, search: "MYH3' OR 1=1 --", chromosome: '17', sort: 'Position', descending: false };
    const selection = demoSelection(['Gene', 'Chromosome', 'Position'], q);
    expect(selection.where).toContain("MYH3'' OR 1=1 --");
    expect(selection.order).toContain('TRY_CAST("Position" AS DOUBLE)');
    expect(demoSelection(['Copy_Number'], { ...q, sort: 'Copy_Number' }).order).toContain('TRY_CAST("Copy_Number" AS DOUBLE)');
    expect(() => demoSelection(['Gene'], { ...q, sort: 'Gene; DROP TABLE source' })).toThrow();
    expect(() => demoSelection(['Gene'], { ...q, sort: '', page: -1 })).toThrow();
  });
  it('uses a path-scoped page and worker CSP without API, uploads, forms or external connections', () => {
    for (const worker of [false, true]) {
      const policy = demoContentSecurityPolicy('nonce', 'https://demo.test', worker);
      const connect = policy.split('; ').find(d => d.startsWith('connect-src'))!;
      expect(connect).not.toContain("'self'");
      expect(connect).not.toContain('/api');
      expect(connect).not.toContain('cloudflare');
      expect(connect).toContain('https://demo.test' + DEMO_BASE);
      expect(policy).toContain("form-action 'none'");
      expect(policy).toContain('worker-src https://demo.test/demo-engine/1.32.0/');
    }
    expect(isDemoPath('/demo')).toBe(true);
    expect(isDemoPath('/demographic')).toBe(false);
    expect(isDemoPath('/api/demo')).toBe(false);
  });
  it('has no transitive runtime dependency on business clients or providers', () => {
    const visited = new Set<string>();
    const walk = (file: string) => {
      if (visited.has(file)) return;
      visited.add(file);
      expect(file).not.toMatch(/(?:lib[\\/](?:api|auth|tasks|parquet-browser|pageAgent|assessment[\\/](?:client|transport))\.[tj]sx?|providers[\\/](?:Auth|Upload|AI)|result-api\.)/);
      const output = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
      for (const match of output.matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
        const path = match[1];
        if (!path.startsWith('.') && !path.startsWith('@/')) continue;
        const base = path.startsWith('@/') ? resolve('src', path.slice(2)) : resolve(dirname(file), path);
        const target = ['.ts', '.tsx', '/index.ts', '/index.tsx'].map(ext => base + ext).find(existsSync);
        if (target) walk(target);
      }
    };
    walk(resolve('src/app/demo/DemoBrowser.tsx'));
    walk(resolve('src/components/providers/PublicProviders.tsx'));
    expect(visited.size).toBeGreaterThan(5);
  });
});
