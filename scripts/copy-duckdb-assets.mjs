import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('@duckdb/duckdb-wasm'));
await mkdir('public/duckdb', { recursive: true });
await mkdir('public/duckdb/1.32.0-csp2', { recursive: true });
for (const file of ['duckdb-mvp.wasm', 'duckdb-eh.wasm', 'duckdb-browser-mvp.worker.js', 'duckdb-browser-eh.worker.js']) {
  await copyFile(join(root, file), join('public/duckdb', file));
  await copyFile(join(root, file), join('public/duckdb/1.32.0-csp2', file));
}

const manifest = JSON.parse(await readFile('scripts/duckdb-extensions.json', 'utf8'));
const installed = JSON.parse(await readFile(join(root, '../package.json'), 'utf8'));
if (installed.version !== manifest.packageVersion) throw new Error('DuckDB extension manifest version mismatch');
for (const asset of manifest.extensions) {
  const target = join('public/duckdb/extensions', asset.path);
  let data;
  try { data = await readFile(target); } catch { /* download a pinned official asset */ }
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  if (!data || hash(data) !== asset.sha256) {
    const response = await fetch(`https://extensions.duckdb.org/${asset.path}`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip' }, signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`DuckDB extension download failed: ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
    if (data[0] === 0x1f && data[1] === 0x8b) data = gunzipSync(data);
    if (hash(data) !== asset.sha256) throw new Error('DuckDB extension checksum mismatch');
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }
}
