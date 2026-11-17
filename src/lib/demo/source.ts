import { DEMO_BASE, DEMO_MANIFEST, DEMO_VERSION, DEMO_ENGINE } from './policy';
import { fieldType, ident, literal, localPredicate, type LocalFilter } from '@/lib/parquet-browser-sql';
import { awaitWorkerStartup, configureBrowserRuntime } from '@/lib/parquet-runtime';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

export interface DemoFile { id: string; label: string; file: string; bytes: number; sha256: string; rows: number; originalRows: number; columns: string[] }
export interface DemoManifest {
  version: string;
  source: { template: string; revision: string; reference: string; pipeline: string };
  sample: { name: string; description: string; sex: string; age: number; hpo: { id: string; name: string }[] };
  qc: Record<string, unknown>;
  requiredVariant: { reference: string; chromosome: string; position: number; ref: string; alt: string; gene: string };
  files: DemoFile[];
}
export interface DemoPage { rows: Record<string, unknown>[]; total: number }
export interface DemoQuery { page: number; pageSize: number; search: string; chromosome: string; sort: string; descending: boolean; columnFilters?: LocalFilter[]; impossible?: boolean }

export function staticDemoURL(file: string) {
  if (!/^[a-z0-9][a-z0-9.-]*\.(?:json|parquet)$/.test(file) || file.includes('..')) throw new Error('Invalid demo resource');
  return DEMO_BASE + file;
}

export function validateManifest(value: unknown): DemoManifest {
  const m = value as DemoManifest;
  if (!m || m.version !== DEMO_VERSION || !m.source?.reference || !m.sample?.name || !m.requiredVariant || !Array.isArray(m.files) || !m.files.length) throw new Error('Invalid demo manifest');
  const names = new Set<string>();
  for (const f of m.files) {
    if (!f || !/^[a-z][a-z0-9-]*$/.test(f.id) || names.has(f.id) || !f.file.endsWith('.parquet') || !/^[a-f0-9]{64}$/.test(f.sha256) || !Number.isSafeInteger(f.bytes) || f.bytes <= 0 || f.bytes > 32 * 1024 * 1024 || !Number.isSafeInteger(f.rows) || f.rows < 0 || !Array.isArray(f.columns) || !f.columns.every(c => typeof c === 'string') || new Set(f.columns).size !== f.columns.length) throw new Error('Invalid demo dataset');
    staticDemoURL(f.file); names.add(f.id);
  }
  return m;
}

/** No tokens, cookies, signed URLs, redirects or production fallbacks. */
async function resource(path: string, signal: AbortSignal) {
  if (path !== DEMO_MANIFEST && !path.startsWith(DEMO_BASE)) throw new Error('Resource outside demo');
  const response = await fetch(path, { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'force-cache', signal });
  if (!response.ok) throw new Error(`Demo resource unavailable (${response.status})`);
  return response;
}
export async function loadDemoManifest(signal: AbortSignal) {
  return validateManifest(await (await resource(DEMO_MANIFEST, signal)).json());
}
export async function loadDemoFile(manifest: DemoManifest, id: string, signal: AbortSignal) {
  const entry = manifest.files.find(f => f.id === id);
  if (!entry) throw new Error('Unknown demo dataset');
  const data = new Uint8Array(await (await resource(staticDemoURL(entry.file), signal)).arrayBuffer());
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), b => b.toString(16).padStart(2, '0')).join('');
  if (data.byteLength !== entry.bytes || hash !== entry.sha256) throw new Error('Demo checksum mismatch');
  return data;
}

export function demoSelection(columns: string[], q: DemoQuery) {
  if (![10, 20, 25, 50, 100, 200].includes(q.pageSize) || !Number.isSafeInteger(q.page) || q.page < 1) throw new Error('Invalid page');
  if (q.sort && !columns.includes(q.sort)) throw new Error('Invalid sort field');
  const predicates: string[] = [];
  if (q.impossible) predicates.push('FALSE');
  for (const filter of q.columnFilters ?? []) {
    if (!columns.includes(filter.column)) throw new Error('Invalid filter field');
    predicates.push(localPredicate(filter, columns));
  }
  if (q.search.trim()) predicates.push(`(${columns.map(c => `contains(lower(COALESCE(CAST(${ident(c)} AS VARCHAR),'')), lower(${literal(q.search.trim())}))`).join(' OR ')})`);
  const chromosome = columns.find(c => /^(chromosome|chrom|chr)$/i.test(c));
  if (q.chromosome && chromosome) predicates.push(`regexp_replace(CAST(${ident(chromosome)} AS VARCHAR),'^chr','') = ${literal(q.chromosome)}`);
  const numericSort = fieldType(q.sort) === 'number' || fieldType(q.sort.toLowerCase()) === 'number';
  return {
    where: predicates.length ? ' WHERE ' + predicates.join(' AND ') : '',
    order: q.sort ? ` ORDER BY ${numericSort ? `TRY_CAST(${ident(q.sort)} AS DOUBLE)` : ident(q.sort)} ${q.descending ? 'DESC' : 'ASC'} NULLS LAST, __demo_ordinal` : ' ORDER BY __demo_ordinal',
    page: ` LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
  };
}

/** One immutable local database. Its public surface contains no write methods. */
export class DemoSource {
  private db?: AsyncDuckDB;
  private conn?: AsyncDuckDBConnection;
  private worker?: Worker;
  private controller = new AbortController();
  private tables = new Map<string, string[]>();
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;
  async open(manifest: DemoManifest) {
    try {
      const d = await import('@duckdb/duckdb-wasm');
      const bundle = await d.selectBundle({ mvp: { mainModule: '/duckdb/1.32.0-csp2/duckdb-mvp.wasm', mainWorker: DEMO_ENGINE + 'duckdb-browser-mvp.worker.js' }, eh: { mainModule: '/duckdb/1.32.0-csp2/duckdb-eh.wasm', mainWorker: DEMO_ENGINE + 'duckdb-browser-eh.worker.js' } });
      this.controller.signal.throwIfAborted();
      this.worker = new Worker(bundle.mainWorker!);
      this.db = new d.AsyncDuckDB(new d.VoidLogger(), this.worker);
      const files = await Promise.all([
        Promise.all(manifest.files.map(async f => ({ entry: f, bytes: await loadDemoFile(manifest, f.id, this.controller.signal) }))),
        awaitWorkerStartup(this.worker, progress => this.db!.instantiate(bundle.mainModule, null, progress), this.controller.signal),
      ]);
      this.controller.signal.throwIfAborted();
      this.conn = await this.db.connect();
      await configureBrowserRuntime(this.conn, location.origin);
      for (const { entry, bytes } of files[0]) {
        await this.db.registerFileBuffer(entry.file, bytes);
        await this.conn.query(`CREATE TABLE ${ident(entry.id)} AS SELECT *, file_row_number AS __demo_ordinal FROM read_parquet(${literal(entry.file)},file_row_number=true)`);
        await this.db.dropFile(entry.file);
        const n = Number((await this.conn.query(`SELECT count(*) AS n FROM ${ident(entry.id)}`)).toArray()[0].n);
        if (n !== entry.rows) throw new Error('Demo row count mismatch');
        const columns = (await this.conn.query(`DESCRIBE ${ident(entry.id)}`)).toArray().map(r => String(r.column_name)).filter(c => !['__demo_ordinal', 'file_row_number'].includes(c));
        if (JSON.stringify(columns) !== JSON.stringify(entry.columns)) throw new Error('Demo columns mismatch');
        this.tables.set(entry.id, columns);
      }
    } catch (error) { await this.close(); throw error; }
  }
  query(id: string, q: DemoQuery): Promise<DemoPage> {
    const run = async () => {
      if (this.closed || !this.conn || !this.tables.has(id)) throw new Error('Demo is not ready');
      const columns = this.tables.get(id)!;
      const selection = demoSelection(columns, q);
      const total = Number((await this.conn.query(`SELECT count(*) AS n FROM ${ident(id)} t${selection.where}`)).toArray()[0].n);
      const result = await this.conn.query(`SELECT ${columns.map(ident).join(',')}, __demo_ordinal FROM ${ident(id)} t${selection.where}${selection.order}${selection.page}`);
      return { total, rows: result.toArray().map(r => r.toJSON() as Record<string, unknown>) };
    };
    const result = this.queue.then(run);
    this.queue = result.catch(() => undefined);
    return result;
  }
  async close() {
    this.closed = true; this.controller.abort();
    // Immediate termination also interrupts a query or a pending engine startup.
    this.worker?.terminate();
    this.tables.clear();
  }
}
