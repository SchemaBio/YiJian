'use client';
import { api, ApiError } from './api';
import {assessTask, clearAssessments, invalidateAssessment, reassessTask} from './assessment/client';
import type {AssessmentContext, AssessmentRow, ResultTable} from './assessment/types';
import {streamAssessmentRows} from './assessment/stream';
import {iscnCandidateSQL} from '@/app/(main)/tasks/[uuid]/utils/cnv-nomenclature';
import { awaitWorkerStartup, configureBrowserRuntime } from './parquet-runtime';
import { buildLocalSelection, effectiveField, fieldType, ident, literal, OVERLAY_FIELDS, type LocalQuery } from './parquet-browser-sql';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
interface DatasetInfo {
    dataset: {
        id: string;
        executionAttemptId: string;
        dataVersion: string;
        objectSha256: string;
        rows: number;
        expectedRows?: number;
        automaticAssessmentProfile: string;
    };
    url: string;
    automaticUrl?: string;
    automaticEncoding?: string;
    expiresAt: string;
    columns: string[];
    aliases: Record<string, string[]>;
}
interface Overlay {
    rowId: string;
    version: number;
    adjustments: Record<string, unknown>;
}
interface Changes {
    revision: number;
    items: Overlay[];
}
export interface BrowserPage {
    items: Record<string, unknown>[];
    total: number;
    rowCount: number;
    columns: string[];
    columnTypes: Record<string, 'text' | 'number' | 'enum' | 'boolean'>;
    columnAliases?: Record<string, string[]>;
    fieldProfileVersion: string;
    version: string;
    attemptId: string;
    offset: number;
    limit: number;
}
const sessions = new Map<string, {
    engine: BrowserTable;
    promise: Promise<BrowserTable>;
    ready: boolean;
}>();
const contexts = new Map<string, string>();
const activeTables = new Map<string, number>();
const abortError = () => new DOMException('请求已取消', 'AbortError');
const check = (signal?: AbortSignal) => { if (signal?.aborted)
    throw abortError(); };
function object(v: unknown): Record<string, unknown> { if (typeof v === 'string')
    return JSON.parse(v); return (v ?? {}) as Record<string, unknown>; }
class BrowserTable {
    private worker!: Worker;
    private db!: AsyncDuckDB;
    private conn!: AsyncDuckDBConnection;
    private raw: string[] = [];
    private revision = 0;
    private lastUsed = Date.now();
    private disposed = false;
    private lifecycle = new AbortController();
    private timer?: ReturnType<typeof setTimeout>;
    private queue: Promise<unknown> = Promise.resolve();
    private info!: DatasetInfo;
    private pages = new Map<string, BrowserPage>();
    private counts = new Map<string, number>();
    constructor(private task: string, private table: string) { }
    private base() { return `/v1/tasks/${encodeURIComponent(this.task)}/results/tables/${encodeURIComponent(this.table)}`; }
    private scope() { return { attemptId: this.info.dataset.executionAttemptId, datasetVersion: this.info.dataset.dataVersion }; }
    private joined() { return 'FROM source t LEFT JOIN overlays o ON o.row_id=t.__row_id LEFT JOIN automatic a ON a.row_id=t.__row_id'; }
    private async binary(kind: 'url' | 'automaticUrl', retry = true): Promise<Uint8Array> {
        check(this.lifecycle.signal);
        const controller = new AbortController();
        const abort = () => controller.abort();
        this.lifecycle.signal.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(() => controller.abort(), 90000);
        try {
            const url = this.info[kind];
            if (!url)
                throw new Error('数据读取授权缺失');
            // COS GET signatures do not authorize HEAD. Explicit GET avoids the
            // remote filesystem's HEAD probe and downloads compressed Parquet once.
            const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
            if ((response.status === 401 || response.status === 403) && retry) {
                const next = await api.get<DatasetInfo>(this.base() + '/browser');
                if (next.dataset.dataVersion !== this.info.dataset.dataVersion || next.dataset.executionAttemptId !== this.info.dataset.executionAttemptId)
                    throw new Error('结果数据集已更新，请刷新页面');
                this.info = next;
                return this.binary(kind, false);
            }
            if (!response.ok)
                throw new Error('对象存储读取失败，请检查授权与 CORS');
            if (Number(response.headers.get('Content-Length')) > 128 * 1024 * 1024)
                throw new Error('数据文件超过本地读取限额，请缩小数据集或使用内存更充足的浏览器');
            const buffer = await response.arrayBuffer();
            if (buffer.byteLength > 128 * 1024 * 1024)
                throw new Error('数据文件超过本地读取限额，请缩小数据集或使用内存更充足的浏览器');
            if (kind === 'url') {
                const digest = await crypto.subtle.digest('SHA-256', buffer);
                const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
                if (hash !== this.info.dataset.objectSha256)
                    throw new Error('Parquet 内容校验失败');
            }
            if (kind === 'automaticUrl' && this.info.automaticEncoding === 'gzip') {
                const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
                const decoded = await new Response(stream).arrayBuffer();
                if (decoded.byteLength > 128 * 1024 * 1024) throw new Error('自动评估基线超过本地读取限额');
                return new Uint8Array(decoded);
            }
            return new Uint8Array(buffer);
        }
        finally {
            clearTimeout(timer);
            this.lifecycle.signal.removeEventListener('abort', abort);
        }
    }
    private async rows(sql: string, signal?: AbortSignal) {
        check(signal);
        let cancelling: Promise<unknown> | undefined;
        const cancel = () => { cancelling = this.conn.cancelSent().catch(() => undefined); };
        signal?.addEventListener('abort', cancel, { once: true });
        try {
            const stream = await this.conn.send(sql, true);
            const result: Record<string, unknown>[] = [];
            for await (const batch of stream) {
                check(signal);
                result.push(...batch.toArray().map(row => row.toJSON() as Record<string, unknown>));
            }
            check(signal);
            return result;
        }
        finally {
            signal?.removeEventListener('abort', cancel);
            await cancelling;
        }
    }
    async open() {
        try {
            const started = performance.now();
            const timings: Record<string, number> = {};
            const timed = async <T>(stage: string, action: () => Promise<T>) => {
                const at = performance.now();
                const value = await action();
                timings[stage] = Math.round(performance.now() - at);
                return value;
            };
            this.info = await timed('authorization_ms', () => api.get<DatasetInfo>(this.base() + '/browser', { signal: this.lifecycle.signal }));
            // Object transfer and WASM startup are independent. Attach all promises
            // immediately so failures are observed and close() aborts other downloads.
            const [parquet] = await Promise.all([
                timed('parquet_download_ms', () => this.binary('url')),
                timed('worker_startup_ms', async () => {
                    const d = await import('@duckdb/duckdb-wasm');
                    const bundle = await d.selectBundle({ mvp: { mainModule: '/duckdb/1.32.0-csp2/duckdb-mvp.wasm', mainWorker: '/duckdb/1.32.0-csp2/duckdb-browser-mvp.worker.js' }, eh: { mainModule: '/duckdb/1.32.0-csp2/duckdb-eh.wasm', mainWorker: '/duckdb/1.32.0-csp2/duckdb-browser-eh.worker.js' } });
                    check(this.lifecycle.signal);
                    this.worker = new Worker(bundle.mainWorker!);
                    this.db = new d.AsyncDuckDB(new d.VoidLogger(), this.worker);
                    await awaitWorkerStartup(this.worker, progress => this.db.instantiate(bundle.mainModule, null, progress), this.lifecycle.signal);
                    check(this.lifecycle.signal);
                    this.conn = await this.db.connect();
                    await configureBrowserRuntime(this.conn, window.location.origin);
                }),
            ]);
            check(this.lifecycle.signal);
            await this.db.registerFileBuffer('result.parquet', parquet);
            const materializeStarted = performance.now();
            // Materialize once in the worker; subsequent interactive queries make no
            // server query or object-store request. Ordinal identity precedes filtering.
            const seed = this.info.dataset.id + '/' + this.info.dataset.objectSha256 + '/';
            await this.conn.query(`CREATE TABLE source AS SELECT *, sha256(${literal(seed)} || CAST(file_row_number AS VARCHAR)) AS __row_id FROM read_parquet('result.parquet',file_row_number=true)`);
            await this.db.dropFile('result.parquet');
            const count = Number((await this.rows('SELECT count(*) AS n FROM source'))[0].n);
            if (count !== this.info.dataset.rows || (this.info.dataset.expectedRows !== undefined && count !== this.info.dataset.expectedRows))
                throw new Error('Parquet 行数校验失败，请联系管理员恢复数据集');
            this.raw = (await this.rows('DESCRIBE source')).map(row => String(row.column_name)).filter(s => s !== 'file_row_number' && s !== '__row_id');
            // Interval length is displayed from endpoints. Register the same
            // expression locally so its header filters the displayed value.
            if (['cnv-segment', 'cnv-exon', 'upd'].includes(this.table) && !this.raw.some(f => this.info.aliases[f]?.includes('length'))) {
                const start = this.raw.find(f => this.info.aliases[f]?.includes('startPosition'));
                const end = this.raw.find(f => this.info.aliases[f]?.includes('endPosition'));
                if (start && end) {
                    await this.conn.query(`ALTER TABLE source ADD COLUMN Interval_Length BIGINT; UPDATE source SET Interval_Length=GREATEST(0, TRY_CAST(${ident(end)} AS BIGINT)-TRY_CAST(${ident(start)} AS BIGINT)${this.table === 'upd' ? '+1' : ''})`);
                    this.raw.push('Interval_Length');
                    this.info.aliases.Interval_Length = ['length'];
                }
            }
            if (this.table === 'cnv-segment' || this.table === 'cnv-exon') {
                const expression=iscnCandidateSQL(this.raw,this.table);
                if(expression){
                    await this.conn.query(`ALTER TABLE source ADD COLUMN ISCN_Candidate VARCHAR; UPDATE source SET ISCN_Candidate=${expression}`);
                    this.raw.push('ISCN_Candidate');
                    this.info.aliases.ISCN_Candidate=['iscnCandidate'];
                }
            }
            timings.parquet_materialize_ms = Math.round(performance.now() - materializeStarted);
            const baselineStarted = performance.now();
            await this.conn.query('CREATE TABLE overlays(row_id VARCHAR PRIMARY KEY,payload JSON, version BIGINT); CREATE TABLE automatic(row_id VARCHAR PRIMARY KEY,baseline JSON)');
            const evaluated=await assessTask(this.task,(context,table,consume,signal)=>this.readAssessmentRows(context,table,consume,signal),this.lifecycle.signal);
            const baseline=evaluated.filter(row=>row.table===this.table);
            if(baseline.length!==count)throw new Error('全量初评与当前数据集不一致，请刷新结果');
            for(let offset=0;offset<baseline.length;offset+=2000){
                await this.db.registerFileBuffer('automatic.jsonl',new TextEncoder().encode(baseline.slice(offset,offset+2000).map(row=>JSON.stringify(row)).join('\n')));
                await this.conn.query("INSERT INTO automatic SELECT rowId, assessment FROM read_json('automatic.jsonl',columns={rowId:'VARCHAR',assessment:'JSON'},format='newline_delimited')");
                await this.db.dropFile('automatic.jsonl');
                await new Promise(resolve=>setTimeout(resolve,0));
            }
            timings.assessment_materialize_ms = Math.round(performance.now() - baselineStarted);
            await timed('adjustment_sync_ms', () => this.sync(true));
            timings.total_load_ms = Math.round(performance.now() - started);
            // Timings contain no object URLs, annotation values or credentials.
            window.dispatchEvent(new CustomEvent('yijian:result-load-timing', { detail: { taskId: this.task, table: this.table, timings } }));
            this.schedule();
            return this;
        }
        catch (e) {
            await this.close();
            throw new Error(e instanceof Error && !/https?:\/\//.test(e.message) ? e.message : '浏览器数据加载失败，请检查对象存储授权、CORS 或浏览器内存');
        }
    }
    private async readAssessmentRows(context:AssessmentContext,table:ResultTable,consume:(rows:AssessmentRow[])=>Promise<void>,signal:AbortSignal) {
        const combined=AbortSignal.any([signal,this.lifecycle.signal]);
        if(context.attemptId!==this.info.dataset.executionAttemptId)throw new Error('评估执行批次不匹配');
        let relation='source',temporary=false,assessmentFile:string|undefined;
        try {
        if(table!==this.table){
            const info=await api.get<DatasetInfo>(`/v1/tasks/${encodeURIComponent(this.task)}/results/tables/${table}/browser`,{signal:combined});
            if(info.dataset.executionAttemptId!==context.attemptId)throw new Error('评估执行批次发生变化');
            const response=await fetch(info.url,{credentials:'omit',signal:combined});
            if(!response.ok || Number(response.headers.get('Content-Length'))>128*1024*1024)throw new Error('评估数据读取失败');
            const buffer=await response.arrayBuffer();if(buffer.byteLength>128*1024*1024)throw new Error('评估文件超过限额');
            const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
            if(hash!==info.dataset.objectSha256)throw new Error('评估数据内容校验失败');
            // DuckDB retains external file/page metadata after dropFile(). A
            // reused path can read the previous dataset's compressed pages.
            assessmentFile=`assessment-${table}-${info.dataset.objectSha256}.parquet`;
            await this.db.registerFileBuffer(assessmentFile,new Uint8Array(buffer));
            const seed=info.dataset.id+'/'+info.dataset.objectSha256+'/';
            await this.conn.query(`CREATE TEMP TABLE assessment_source AS SELECT *,sha256(${literal(seed)}||CAST(file_row_number AS VARCHAR)) AS __row_id FROM read_parquet(${literal(assessmentFile)},file_row_number=true)`);
            relation='assessment_source';temporary=true;
            const count=Number((await this.rows('SELECT count(*) AS n FROM assessment_source'))[0].n);
            if(count!==info.dataset.rows || (info.dataset.expectedRows!==undefined&&count!==info.dataset.expectedRows))throw new Error('评估数据行数校验失败');
        }
            // One Arrow stream with backpressure replaces repeated full-table
            // sorts/OFFSET scans. Ordinal hashes already fix each row's identity.
            const columns=(await this.rows(`DESCRIBE ${relation}`,combined)).map(row=>String(row.column_name));
            await streamAssessmentRows(this.conn,relation,columns,table,consume,combined);
        } finally {
            try {if(temporary)await this.conn.query('DROP TABLE assessment_source');}
            finally {if(assessmentFile)await this.db.dropFile(assessmentFile);}
        }
    }
    private serialize<T>(fn: () => Promise<T>): Promise<T> {
        const result = this.queue.then(() => { if (this.disposed)
            throw new Error('本地查询已关闭'); return fn(); });
        this.queue = result.catch(() => undefined);
        return result;
    }
    private async apply(items: Overlay[]) {
        if (!items.length)
            return;
        const file = 'overlay-delta.jsonl';
        const data = items.map(row => JSON.stringify({ row_id: row.rowId, payload: JSON.stringify(row.adjustments), version: row.version })).join('\n');
        await this.db.registerFileBuffer(file, new TextEncoder().encode(data));
        await this.conn.query('BEGIN');
        try {
            await this.conn.query(`INSERT INTO overlays SELECT row_id,payload::JSON,version FROM read_json_auto('${file}',format='newline_delimited') ON CONFLICT(row_id) DO UPDATE SET payload=excluded.payload,version=excluded.version WHERE excluded.version>=overlays.version`);
            await this.conn.query('COMMIT');
            this.pages.clear();
            this.counts.clear();
        }
        catch (e) {
            await this.conn.query('ROLLBACK');
            throw e;
        }
        finally {
            await this.db.dropFile(file);
        }
    }
    private async sync(initial = false) {
        const changes = await api.get<Changes>(this.base() + '/adjustments', { params: { ...this.scope(), ...(initial ? {} : { since: String(this.revision) }) } });
        await this.apply(changes.items);
        this.revision = changes.revision;
        return changes.items.length > 0;
    }
    private schedule() {
        this.timer = setTimeout(() => {
            if (!activeTables.has(this.task + '/' + this.table) && Date.now() - this.lastUsed > 120000) {
                if (sessions.get(this.task + '/' + this.table)?.engine === this)
                    sessions.delete(this.task + '/' + this.table);
                void this.close();
                return;
            }
            void this.serialize(async () => {
                const changed = await this.sync();
                if (changed)
                    window.dispatchEvent(new CustomEvent('yijian:result-overlays-synced', { detail: { taskId: this.task, table: this.table } }));
            }).catch(async (cause) => {
                if (cause instanceof ApiError && cause.status === 409) {
                    sessions.delete(this.task + '/' + this.table);
                    await this.close();
                    window.dispatchEvent(new CustomEvent('yijian:result-overlays-synced', { detail: { taskId: this.task, table: this.table } }));
                }
                else
                    window.dispatchEvent(new CustomEvent('yijian:result-sync-error', { detail: { taskId: this.task, table: this.table } }));
            }).finally(() => { if (!this.disposed)
                this.schedule(); });
        }, 10000);
    }
    async query(q: LocalQuery, signal?: AbortSignal): Promise<BrowserPage> {
        this.lastUsed = Date.now();
        return this.serialize(async () => {
            check(signal);
            const key = JSON.stringify(q);
            const cached = this.pages.get(key);
            if (cached)
                return structuredClone(cached);
            const selection = buildLocalSelection(q, this.raw);
            let total = this.counts.get(selection.where);
            if (total === undefined) {
                total = Number((await this.rows('SELECT count(*) AS n ' + this.joined() + selection.where, signal))[0].n);
                if (this.counts.size >= 40)
                    this.counts.delete(this.counts.keys().next().value!);
                this.counts.set(selection.where, total);
            }
            check(signal);
            const limit = Math.max(1, Math.min(200, q.limit)), offset = Math.max(0, q.offset);
            const result = await this.rows(`SELECT t.*,o.payload AS __adjustments,COALESCE(o.version,0) AS __version,a.baseline AS __acmg ${this.joined()}${selection.where} ORDER BY ${selection.order} LIMIT ${limit} OFFSET ${offset}`, signal);
            check(signal);
            const page = { items: result.map(row => this.normalize(row)), total, rowCount: this.info.dataset.rows, columns: [...new Set([...this.raw, ...OVERLAY_FIELDS.filter(field => field !== 'reviewed')])].sort(), columnTypes: Object.fromEntries([...this.raw, ...OVERLAY_FIELDS.filter(field => field !== 'reviewed')].map(s => [s, fieldType(s)])), columnAliases: this.info.aliases, fieldProfileVersion: 'parquet-fields-v2', version: this.info.dataset.dataVersion, attemptId: this.info.dataset.executionAttemptId, offset, limit };
            if (this.pages.size >= 20)
                this.pages.delete(this.pages.keys().next().value!);
            this.pages.set(key, page);
            return structuredClone(page);
        });
    }
    private normalize(source: Record<string, unknown>): Record<string, unknown> {
        const row: Record<string, unknown> = {};
        for (const col of this.raw)
            for (const key of this.info.aliases[col] ?? [col])
                row[key] = source[col];
        const auto = object(source.__acmg), overlay = object(source.__adjustments);
        row.automaticAssessment=auto;
        row.pinReasons=auto.pinReasons;
        Object.assign(row, { id: source.__row_id, rowId: source.__row_id, rowOrdinal: Number(source.file_row_number), reviewed: false, reported: false, adjustments: overlay, adjustmentVersion: Number(source.__version), datasetVersion: this.info.dataset.dataVersion, attemptId: this.info.dataset.executionAttemptId });
        if (this.table === 'snv-indel') {
            row.annotationValues = Object.fromEntries(this.raw.map(s => [s, source[s]]));
            row.automaticAcmg = auto;
            row.acmgClassification = auto.classification;
            row.acmgClassificationComputed = auto.classification;
            row.acmgAssessmentSource = 'automatic';
            row.alleleFrequency = source.VAF;
            row.vaf = source.VAF;
        }
        if (this.table === 'cnv-segment' || this.table === 'cnv-exon') {
            row.annotationValues = Object.fromEntries(this.raw.map(s => [s, source[s]]));
            row.cnvClassification=auto.cnvClassification;
            row.cnvScore=auto.cnvScore;
            row.classification=auto.cnvClassification;
            row.totalScore=auto.cnvScore;
        }
        if (this.table === 'cnv-segment') {
            row.copyNumber = source.CN ?? source.Copy_Number ?? source.Col8;
            row.copyRatio = source.Copy_Ratio; // Never interpret absolute CN as a ratio.
            row.log2Ratio = source.Log2_Ratio ?? source.log2 ?? source.Col5;
        }
        if (this.table === 'cnv-exon') {
            row.copyNumber = source.Copy_Number ?? source.CN ?? source.Col12;
            row.copyRatio = source.Copy_Ratio;
            row.log2Ratio = source.Log2_Ratio ?? source.Col9;
            row.weight = source.Col14;
            row.confidenceLabel = source.Col18;
        }
        Object.assign(row, overlay);
        if (overlay.acmgOverride)
            row.acmgAssessmentSource = 'manual_override';
        else if ('acmgEvidence' in overlay)
            row.acmgAssessmentSource = 'manual_evidence';
        // Explicit false is an enduring user override, not a missing value.
        const effectiveClass = overlay.acmgOverride || row.acmgClassification || object(overlay.cnvAssessment).classification;
        const manualClassification=!!overlay.acmgOverride || 'acmgEvidence' in overlay || 'cnvAssessment' in overlay;
        row.pinned = typeof overlay.pinned === 'boolean' ? overlay.pinned : manualClassification ? ['Pathogenic', 'Likely_Pathogenic'].includes(String(effectiveClass)) : auto.pinned===true;
        row.pinSource = typeof overlay.pinned === 'boolean' || manualClassification ? 'manual' : row.pinned ? 'automatic' : undefined;
        row.reviewStatus = { pinned: row.pinned, reviewed: row.reviewed, reported: row.reported };
        return row;
    }
    async export(q: LocalQuery) {
        this.lastUsed = Date.now();
        return this.serialize(async () => {
            // Catch edits from other browsers before creating an effective export.
            await this.sync();
            const selection = buildLocalSelection(q, this.raw);
            const fields = [...this.raw.map(s => 't.' + ident(s)), 't.__row_id AS row_id', ...OVERLAY_FIELDS.map(s => effectiveField(s, this.raw) + ' AS ' + ident(s))];
            await this.conn.query(`COPY (SELECT ${fields.join(',')} ${this.joined()}${selection.where} ORDER BY ${selection.order}) TO 'filtered.csv' (FORMAT CSV,HEADER TRUE)`);
            const bytes = await this.db.copyFileToBuffer('filtered.csv');
            await this.db.dropFile('filtered.csv');
            return { blob: new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'text/csv;charset=utf-8' }), filename: `results-${this.table}.csv` };
        });
    }
    async updated(row: Overlay) { return this.serialize(() => this.apply([row])); }
    async refresh() { this.lastUsed = Date.now(); return this.serialize(() => this.sync()); }
    async close() { if (this.disposed)
        return; this.disposed = true; this.lifecycle.abort(); if (this.timer)
        clearTimeout(this.timer); try {
        await this.conn?.close();
        await this.db?.terminate();
    }
    finally {
        this.worker?.terminate();
    } }
}
async function session(task: string, table: string) {
    if (typeof Worker === 'undefined')
        throw new Error('当前浏览器不支持本地分析，请使用支持 WebAssembly 和 Worker 的浏览器');
    const key = task + '/' + table;
    let record = sessions.get(key);
    if (!record) {
        // Keep at most two inactive datasets warm; never evict a visible table.
        for (const [old, r] of sessions) {
            if (sessions.size < 2)
                break;
            // An opening table may own the task-wide assessment stream. A tab
            // switch must not terminate that worker while other tables await it.
            if (r.ready && !activeTables.has(old)) {
                sessions.delete(old);
                void r.engine.close().catch(() => undefined);
            }
        }
        const engine = new BrowserTable(task, table), promise = engine.open();
        record = { engine, promise, ready:false };
        sessions.set(key, record);
        const owned = record;
        void promise.then(()=>{owned.ready=true;},()=>undefined);
        promise.catch(() => { if (sessions.get(key) === owned)
            sessions.delete(key); });
    }
    return record.promise;
}
export async function queryBrowserParquet(task: string, table: string, q: LocalQuery, signal?: AbortSignal) { check(signal); const s = await session(task, table); check(signal); return s.query(q, signal); }
export async function exportBrowserParquet(task: string, table: string, q: LocalQuery) { return (await session(task, table)).export(q); }
export async function updateBrowserOverlay(task: string, table: string, row: Overlay) {
    const key = task + '/' + table, r = sessions.get(key);
    if (r)
        try {
            await (await r.promise).updated(row);
        }
        catch (e) {
            if (sessions.get(key) === r)
                sessions.delete(key);
            await r.engine.close();
            throw e;
        }
}
export async function refreshBrowserTable(task: string, table: string) { return (await session(task, table)).refresh(); }
export function retainBrowserTable(task: string, table: string) {
    const key = task + '/' + table;
    activeTables.set(key, (activeTables.get(key) ?? 0) + 1);
    return () => { const count = (activeTables.get(key) ?? 1) - 1; if (count <= 0)
        activeTables.delete(key);
    else
        activeTables.set(key, count); };
}
export async function clearBrowserResults() { clearAssessments();const active = [...sessions.values()]; sessions.clear(); await Promise.allSettled(active.map(r => r.engine.close())); }
export async function reevaluateBrowserResults(task:string){await reassessTask(task);const active=[...sessions].filter(([key])=>key.startsWith(task+'/'));for(const[key]of active)sessions.delete(key);await Promise.allSettled(active.map(([,r])=>r.engine.close()));window.dispatchEvent(new CustomEvent('yijian:assessment-reloaded',{detail:{taskId:task}}));}
export async function retryBrowserAssessment(task:string){invalidateAssessment(task);const active=[...sessions].filter(([key])=>key.startsWith(task+'/'));for(const[key]of active)sessions.delete(key);await Promise.allSettled(active.map(([,r])=>r.engine.close()));window.dispatchEvent(new CustomEvent('yijian:assessment-reloaded',{detail:{taskId:task}}));}
export async function updateBrowserContext(task: string, attempt: string, version: string) {
    const next = attempt + '/' + version, previous = contexts.get(task);
    contexts.set(task, next);
    if (previous && previous !== next) {
        invalidateAssessment(task);
        const active = [...sessions].filter(([key]) => key.startsWith(task + '/'));
        for (const [key] of active)
            sessions.delete(key);
        await Promise.allSettled(active.map(([, r]) => r.engine.close()));
    }
}
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => void clearBrowserResults());
    window.addEventListener('schema:auth-expired', () => void clearBrowserResults());
    window.addEventListener('storage', event => { if (event.key?.includes('org') || event.key?.includes('user'))
        void clearBrowserResults(); });
}
