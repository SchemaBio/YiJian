import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { mkdir, copyFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('@duckdb/duckdb-wasm'));
await mkdir('public/duckdb', { recursive: true });
for (const file of ['duckdb-mvp.wasm', 'duckdb-eh.wasm', 'duckdb-browser-mvp.worker.js', 'duckdb-browser-eh.worker.js']) {
  await copyFile(join(root, file), join('public/duckdb', file));
}
